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
 * 远端原始文本 = removeFromEnd(fullText, localText)。
 * removeFromEnd 从末尾匹配子序列移除，保证 fullText 中 localText 的字符被移除后
 * 剩余的就是远端原始文本。
 *
 * 步骤：
 * 1. undo 前快照每段的 fullText 和 localText。
 * 2. undo 后检测：如果 undo 后本地 items 全部被删除（after.localText 为空），
 *    且 undo 前段内有远端内容（b.remoteText 非空），则说明 undo 删除了该段所有本地内容。
 * 3. 计算 expectedRemote = removeFromEnd(before.fullText, before.localText)。
 * 4. 如果 after.fullText !== expectedRemote，说明远端内容被碎片化，需要恢复。
 * 5. 用 expectedRemote 替换段落内容，恢复使用 ySyncPluginKey origin，通过 setTimeout(0) 异步执行。
 *
 * 不触发恢复的条件：
 * - after.localText 非空：undo 只撤销了部分本地编辑，远端未受影响。
 *   例：A 输入 "Apple" → B 输入 "Banana" → A 追加 " Cherry" → undo Cherry
 *   undo 后 localText="Apple"（非空），说明只撤销了 Cherry，不触发恢复。
 * - after.fullText === expectedRemote：undo 后远端文本恰好正确，无需恢复。
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
 * 从 Y.XmlText 提取纯文本（不含格式标签）。
 * toString() 对带格式的文本返回 '<bold>Hello</bold>'，包含 XML 标签会污染 fullText。
 * 直接遍历 _start 链收集未删除 item 的字符串内容。
 */
function getPureText(xmlText) {
  let text = ""
  let curr = xmlText._start
  while (curr) {
    if (
      !curr.deleted &&
      curr.content &&
      curr.content.str != null
    ) {
      text += curr.content.str
    }
    curr = curr.right
  }
  return text
}

/**
 * 遍历 Y.XmlFragment，收集每段文本。
 * 返回数组：[{ paragraphIndex, fullText, localText, remoteText }]
 *
 * fullText = 所有未删除 items 的文本拼接（纯文本，不含格式标签）
 * localText = 本地 clientID 的未删除 items 文本拼接
 * remoteText = 非本地 clientID 的未删除 items 文本拼接
 *
 * 注意：remoteText 是直接从 CRDT items 按 clientID 过滤后拼接的，
 * 但由于 CRDT split，远端原始文本可能被碎片化（如 "Hello-from-B" → "BHello-from-"）。
 * 因此 remoteText 不能用作远端原始文本的恢复源——
 * 它仅用于检测 undo 是否影响了远端内容。
 */
function snapshotParagraphTexts(ydoc, localClientID) {
  const frag = ydoc.getXmlFragment("default")
  const snapshots = []

  for (let pIdx = 0; pIdx < frag.length; pIdx++) {
    const para = frag.get(pIdx)
    if (!para || !(para instanceof Y.XmlElement)) {
      snapshots.push({ paragraphIndex: pIdx, fullText: "", localText: "", remoteText: "" })
      continue
    }

    let fullText = ""
    let localText = ""
    let remoteText = ""

    for (let cIdx = 0; cIdx < para.length; cIdx++) {
      const child = para.get(cIdx)
      if (!(child instanceof Y.XmlText)) continue
      let curr = child._start
      while (curr) {
        if (
          !curr.deleted &&
          curr.content &&
          curr.content.str != null
        ) {
          fullText += curr.content.str
          if (curr.id && curr.id.client === localClientID) {
            localText += curr.content.str
          } else {
            remoteText += curr.content.str
          }
        }
        curr = curr.right
      }
    }
    snapshots.push({ paragraphIndex: pIdx, fullText, localText, remoteText })
  }
  return snapshots
}

/**
 * 比较快照前后的文本，返回需要恢复的内容项。
 *
 * 核心逻辑（经端到端 trace 确认）：
 *
 * 场景 1（V1）：A="Hello-from-A" B 在 pos0 插入 "Hello-from-B"
 *   undo 前 fullText="Hello-from-BHello-from-A" localText="Hello-from-A"
 *   undo 后 fullText="BHello-from-" localText="" （本地 items 全删，远端碎片化）
 *   after.localText="" 为空 → 触发恢复条件
 *   expectedRemote = removeFromEnd("Hello-from-BHello-from-A", "Hello-from-A") = "Hello-from-B"
 *   after.fullText="BHello-from-" ≠ expectedRemote="Hello-from-B" → 需要恢复 ✓
 *
 * 场景 2（V5 undo Cherry）：A="Apple" B="Banana" A 追加 " Cherry"
 *   undo 前 fullText="BananaApple Cherry" localText="Apple Cherry"
 *   undo 后 fullText="BananaApple" localText="Apple" （本地部分删除，远端未碎片化）
 *   after.localText="Apple" 非空 → 不触发恢复 ✓
 *
 * 触发条件（两个条件同时满足）：
 * 1. after.localText 为空：undo 删除了该段所有本地 items（不是部分撤销）
 * 2. after.fullText !== expectedRemote：undo 后剩余文本与正确远端文本不同（碎片化）
 *
 * 为什么用 before.localText 而非 after.localText 计算 expectedRemote：
 *   before.fullText 包含 undo 前本地的完整文本。
 *   从中移除 before.localText，剩余就是远端原始文本。
 *   after.localText 为空（被 undo 删了），无法用于减法。
 */
function findLostRemoteText(before, after) {
  const lost = []
  const maxLen = Math.max(before.length, after.length)

  for (let i = 0; i < maxLen; i++) {
    const b = before[i] || { fullText: "", localText: "", remoteText: "" }
    const a = after[i] || { fullText: "", localText: "", remoteText: "" }

    // 条件 1：undo 后本地 items 全部被删除（after.localText 为空）
    // 如果 after.localText 非空，说明 undo 只撤销了部分本地编辑，远端未受影响。
    // 条件 2：undo 前段内有远端内容
    if (!a.localText && b.remoteText) {
      // 从 undo 前的完整文本中移除 undo 前的本地文本，得到远端原始文本
      const expectedRemote = removeFromEnd(b.fullText, b.localText)
      // 条件 3：undo 后的完整文本与正确的远端文本不同（说明远端被碎片化）
      if (a.fullText !== expectedRemote) {
        const expectedText = a.localText + expectedRemote
        lost.push({
          paragraphIndex: i,
          expectedText,
          currentText: a.fullText,
        })
      }
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
    const currentText = getPureText(textNode)
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
