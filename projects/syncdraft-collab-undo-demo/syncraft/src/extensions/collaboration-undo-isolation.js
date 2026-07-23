/**
 * Tiptap extension: collaboration-undo-isolation
 *
 * 根因（经真实 Hocuspocus WebSocket 端到端追踪确认）：
 *
 * 当用户 B 在用户 A 已有内容的中间位置插入文本时，Yjs 会 split A 的 CRDT item，
 * 导致 B 的文本被分散到多个 item 中。
 *
 * 例：A="Hello-from-A" B 在 position 0 插入 "Hello-from-B"
 *   CRDT items 变成：
 *     "Hello-from-" (client A) → "BHello-from-" (client B) → "A" (client A)
 *   组合文本 "Hello-from-BHello-from-A" 看起来正确，
 *   但 B 的原始文本 "Hello-from-B" 被 split 成了 "BHello-from-"。
 *
 * UndoManager.undo() 删除 A 的 items 时：
 *   "Hello-from-" (A) 被删除，"A" (A) 被删除
 *   只剩 "BHello-from-" (B) — B 的内容碎片化
 *
 * 修复方案（v3）：
 *
 * 核心洞察：CRDT split 不可逆——一旦 B 的文本被 split，无法从 CRDT 状态
 * 恢复 B 的原始文本。但 undo 前我们能拿到两个关键数据：
 *   1. fullText = 段落完整文本（合并后正确的文本）
 *   2. localText = 本地 client 的所有 items 的文本（A 的文本）
 *
 * 远端原始文本 = fullText 末尾移除 localText。
 * 用 removeFromEnd（从末尾匹配子序列）而非 removeFromStart，
 * 因为 A 的文本通常在段落末尾（B 在开头插入）。
 * 对于 A 的文本在开头的情况，removeFromEnd 也能正确工作
 *（因为子序列匹配会从末尾找到 A 的文本并移除）。
 *
 * 步骤：
 * 1. undo 前快照每段的 fullText 和 localText。
 * 2. 计算 expectedRemote = removeFromEnd(fullText, localText)。
 * 3. undo 后比较当前段落文本与 expectedRemote。
 * 4. 不一致则用 expectedRemote 替换段落内容。
 * 5. 恢复使用 ySyncPluginKey origin，通过 setTimeout(0) 异步执行。
 */

import { Extension } from "@tiptap/core"
import * as Y from "yjs"
import { yUndoPluginKey, ySyncPluginKey } from "@tiptap/y-tiptap"

// ─────────────────────────────────────────────
// 文本工具
// ─────────────────────────────────────────────

/**
 * 从 fullText 末尾移除 sub 的子序列。
 * 从右往左匹配 sub 的字符，匹配到的移除，未匹配的保留。
 *
 * 例：removeFromEnd("Hello-from-BHello-from-A", "Hello-from-A")
 *   → "Hello-from-B" ✓
 *
 * 例：removeFromEnd("Hello-from-AHello-from-B", "Hello-from-A")
 *   → "Hello-from-B" ✓（从末尾匹配 B 之后的字符）
 */
function removeFromEnd(full, sub) {
  if (!sub) return full
  if (full === sub) return ""

  // 快速路径：sub 是 full 的后缀
  if (full.endsWith(sub)) {
    return full.slice(0, full.length - sub.length)
  }

  // 子序列移除：从右往左匹配 sub 的字符
  const result = full.split("")
  let si = sub.length - 1
  for (let fi = result.length - 1; fi >= 0 && si >= 0; fi--) {
    if (result[fi] === sub[si]) {
      result.splice(fi, 1)
      si--
    }
  }
  // si 应该为 0，表示 sub 的所有字符都被匹配移除了
  return result.join("")
}

/**
 * 遍历 Y.XmlFragment，收集每段的 fullText 和 localText。
 * 返回数组：[{ paragraphIndex, fullText, localText }]
 */
function snapshotParagraphTexts(ydoc, localClientID) {
  const frag = ydoc.getXmlFragment("default")
  const snapshots = []

  for (let pIdx = 0; pIdx < frag.length; pIdx++) {
    const para = frag.get(pIdx)
    if (!para || !(para instanceof Y.XmlElement)) {
      snapshots.push({ paragraphIndex: pIdx, fullText: "", localText: "" })
      continue
    }

    let fullText = ""
    let localText = ""

    for (let cIdx = 0; cIdx < para.length; cIdx++) {
      const child = para.get(cIdx)
      if (!(child instanceof Y.XmlText)) continue
      // fullText: 使用 toString() 获取完整文本
      fullText += child.toString()
      // localText: 遍历本地 client 的 items
      let curr = child._start
      while (curr) {
        if (
          !curr.deleted &&
          curr.content &&
          curr.content.str != null &&
          curr.id &&
          curr.id.client === localClientID
        ) {
          localText += curr.content.str
        }
        curr = curr.right
      }
    }
    snapshots.push({ paragraphIndex: pIdx, fullText, localText })
  }
  return snapshots
}

/**
 * 比较快照前后的文本，返回需要恢复的内容项。
 *
 * 核心逻辑：
 * - before.remoteText = removeFromEnd(before.fullText, before.localText)
 *   这是 undo 前远端客户端的原始文本。
 * - after.remoteText = removeFromEnd(after.fullText, after.localText)
 *   这是 undo 后远端客户端的文本。
 * - 如果 after.remoteText != before.remoteText，说明 undo 连带删除/碎片化了远端内容。
 * - 恢复策略：用 before.remoteText 替换当前段落中所有远端 items 的文本。
 *   保留 after.localText（undo 后仍存在的本地文本）不变。
 * - 恢复后的完整文本 = after.localText + before.remoteText（本地在前，远端在后）。
 *   这不是完美的位置恢复，但保证了远端内容不丢失。
 */
function findLostRemoteText(before, after) {
  const lost = []
  const maxLen = Math.max(before.length, after.length)

  for (let i = 0; i < maxLen; i++) {
    const b = before[i] || { fullText: "", localText: "" }
    const a = after[i] || { fullText: "", localText: "" }

    // undo 前的远端文本
    const beforeRemote = removeFromEnd(b.fullText, b.localText)
    // undo 后的远端文本
    const afterRemote = removeFromEnd(a.fullText, a.localText)

    // 如果远端文本发生了变化（被 undo 连带删除/碎片化），则需要恢复
    if (beforeRemote && afterRemote !== beforeRemote) {
      // 恢复后的期望完整文本 = undo 后的本地文本 + undo 前的远端文本
      const expectedText = a.localText + beforeRemote
      lost.push({
        paragraphIndex: i,
        expectedText,
        currentText: a.fullText,
      })
    }
  }
  return lost
}

/**
 * 在 Y.Doc 中恢复丢失的远端内容。
 * 策略：用 expectedText 替换当前段落的全部文本。
 */
function restoreLostContent(ydoc, lost) {
  const frag = ydoc.getXmlFragment("default")

  // 按段落从后往前处理，避免索引偏移
  const sorted = [...lost].sort(
    (a, b) => b.paragraphIndex - a.paragraphIndex
  )

  for (const item of sorted) {
    if (item.paragraphIndex >= frag.length) {
      // 段落不存在，创建新段落
      const newPara = new Y.XmlElement("paragraph")
      const newText = new Y.XmlText()
      newText.insert(0, item.expectedText)
      newPara.insert(0, [newText])
      frag.insert(frag.length, [newPara])
      continue
    }

    const para = frag.get(item.paragraphIndex)
    if (!para || !(para instanceof Y.XmlElement)) continue

    // 找到段落中的 Y.XmlText
    let textNode = null
    for (let i = 0; i < para.length; i++) {
      if (para.get(i) instanceof Y.XmlText) {
        textNode = para.get(i)
        break
      }
    }

    if (!textNode) {
      textNode = new Y.XmlText()
      textNode.insert(0, item.expectedText)
      para.insert(0, [textNode])
      continue
    }

    // 替换全部文本：删除当前文本，插入期望文本
    const currentText = textNode.toString()
    if (currentText !== item.expectedText) {
      if (currentText.length > 0) {
        textNode.delete(0, currentText.length)
      }
      if (item.expectedText) {
        textNode.insert(0, item.expectedText)
      }
    }
  }
}

// ─────────────────────────────────────────────
// Extension
// ─────────────────────────────────────────────

export const CollaborationUndoIsolation = Extension.create({
  name: "collaborationUndoIsolation",

  priority: 1001,

  addCommands() {
    return {
      /**
       * 安全 undo：直接调用 Yjs UndoManager.undo()，
       * 然后异步恢复被连带删除/碎片化的远端内容。
       */
      safeUndo:
        () =>
        ({ tr, editor }) => {
          tr.setMeta("preventDispatch", true)

          const collaborationExt = editor.extensionManager.extensions.find(
            (ext) => ext.name === "collaboration"
          )
          if (!collaborationExt || !collaborationExt.options.document) {
            tr.setMeta("preventDispatch", false)
            return editor.commands.undo()
          }

          const ydoc = collaborationExt.options.document
          const localClientID = ydoc.clientID

          const umState = yUndoPluginKey.getState(editor.view.state)
          const um = umState ? umState.undoManager : null
          if (!um) {
            tr.setMeta("preventDispatch", false)
            return editor.commands.undo()
          }

          // 1. 快照每段的 fullText 和 localText
          const before = snapshotParagraphTexts(ydoc, localClientID)

          // 2. 直接调用 Yjs UndoManager.undo()
          um.undo()

          // 3. 异步恢复丢失的远端内容
          setTimeout(() => {
            const after = snapshotParagraphTexts(ydoc, localClientID)
            const lost = findLostRemoteText(before, after)

            if (lost.length > 0) {
              ydoc.transact(() => {
                restoreLostContent(ydoc, lost)
              }, ySyncPluginKey)
            }
          }, 0)

          return true
        },

      /**
       * 安全 redo：直接调用 Yjs UndoManager.redo()。
       * redo 恢复的是本地刚 undo 掉的内容，是正确行为，不需要远端恢复。
      */
        safeRedo:
        () =>
          ({ tr, editor }) => {
tr.setMeta("preventDispatch", true)

            const collaborationExt = editor.extensionManager.extensions.find(
          (ext) => ext.name === "collaboration"
          )
            if (!collaborationExt || !collaborationExt.options.document) {
            tr.setMeta("preventDispatch", false)
          return editor.commands.redo()
}

          const umState = yUndoPluginKey.getState(editor.view.state)
const um = umState ? umState.undoManager : null
          if (!um) {
          tr.setMeta("preventDispatch", false)
          return editor.commands.redo()
            }

          um.redo()

          return true
},
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-z": () => this.editor.commands.safeUndo(),
      "Mod-y": () => this.editor.commands.safeRedo(),
      "Shift-Mod-z": () => this.editor.commands.safeRedo(),
    }
  },
})
