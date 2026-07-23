/**
 * Tiptap extension: collaboration-undo-isolation
 *
 * 根因（经真实 Hocuspocus WebSocket 端到端追踪确认）：
 *
 * 当用户 B 在用户 A 已有内容的中间位置插入文本时，Yjs 会 split A 的 CRDT item，
 * 导致 B 的 item 在 item 链上依赖 A 的 item。UndoManager.undo() 删除 A 的 item 时，
 * 由于 CRDT 左右依赖关系，B 的 item 也被部分删除/split，文本碎片化。
 *
 * 例：A="Hello-from-A" B 在 position 0 插入 "Hello-from-B"
 *   undo 前: "Hello-from-BHello-from-A"
 *   undo 后: "BHello-from-"  ← B 的内容被碎片化，"Hello-from-B" 变成 "BHello-from-"
 *
 * 当 B 在 A 内容末尾或独立段落插入时不受影响（item 不 split）。
 *
 * 修复方案：
 * 1. 不注册 ProseMirror plugin（避免 ySyncPlugin view.update 回环导致 mismatched transaction）。
 * 2. 直接调用 Yjs UndoManager.undo()（绕过 ProseMirror command 层）。
 * 3. undo 前快照远端完整文本（按段落，只收集非本地 clientID 的 item 文本）。
 * 4. undo 后比较差异，通过 Y.Doc transaction 恢复丢失的远端内容。
 * 5. 恢复使用 ySyncPluginKey origin，通过 setTimeout(0) 异步执行。
 *
 * 注意：远端文本因 split 可能已被碎片化（如 "Hello-from-B" 变成 "BHello-from-"），
 * 所以快照保存的是碎片化后的文本。undo 后如果这段文本完全消失或部分丢失，
 * 则恢复快照中记录的完整碎片化文本。
 */

import { Extension } from "@tiptap/core"
import * as Y from "yjs"
import { yUndoPluginKey, ySyncPluginKey } from "@tiptap/y-tiptap"

// ─────────────────────────────────────────────
// Y.Doc 远端内容快照工具
// ─────────────────────────────────────────────

/**
 * 遍历 Y.XmlFragment，收集每段中远端（非本地 clientID）的文本内容。
 * 返回数组：[{ paragraphIndex, remoteText }]
 * remoteText 是该段落中所有非本地 item 的可见文本拼接。
 */
function snapshotRemoteText(ydoc, localClientID) {
  const frag = ydoc.getXmlFragment("default")
  const snapshots = []

  for (let pIdx = 0; pIdx < frag.length; pIdx++) {
    const para = frag.get(pIdx)
    if (!para || !(para instanceof Y.XmlElement)) {
      snapshots.push({ paragraphIndex: pIdx, remoteText: "" })
      continue
    }

    let remoteText = ""
    for (let cIdx = 0; cIdx < para.length; cIdx++) {
      const child = para.get(cIdx)
      if (!(child instanceof Y.XmlText)) continue
      let curr = child._start
      while (curr) {
        if (
          !curr.deleted &&
          curr.content &&
          curr.content.str != null &&
          curr.id &&
          curr.id.client !== localClientID
        ) {
          remoteText += curr.content.str
        }
        curr = curr.right
      }
    }
    snapshots.push({ paragraphIndex: pIdx, remoteText })
  }
  return snapshots
}

/**
 * 比较快照前后的远端文本内容，返回丢失的内容项。
 */
function findLostRemoteText(before, after) {
  const lost = []
  const maxLen = Math.max(before.length, after.length)

  for (let i = 0; i < maxLen; i++) {
    const b = before[i] || { remoteText: "" }
    const a = after[i] || { remoteText: "" }

    if (b.remoteText !== a.remoteText) {
      if (a.remoteText === "" && b.remoteText !== "") {
        // 远端文本完全消失
        lost.push({
          paragraphIndex: i,
          text: b.remoteText,
          type: "paragraph_deleted",
        })
      } else if (b.remoteText.length > a.remoteText.length) {
        // 远端文本部分丢失（split 导致碎片化后部分被删）
        // 计算丢失的部分
        const lostPart = b.remoteText.replace(a.remoteText, "")
        if (lostPart) {
          lost.push({
            paragraphIndex: i,
            text: lostPart,
            type: "partial_lost",
            remainingRemoteText: a.remoteText,
          })
        }
      }
    }
  }
  return lost
}

/**
 * 在 Y.Doc 中恢复丢失的远端内容。
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
      newText.insert(0, item.text)
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
      para.insert(0, [textNode])
    }

    if (item.type === "paragraph_deleted") {
      // 远端文本完全消失，追加到段落末尾
      textNode.insert(textNode.toString().length, item.text)
    } else if (item.type === "partial_lost") {
      // 远端文本部分丢失，在残留远端文本之后追加丢失部分
      const currentText = textNode.toString()
      if (
        item.remainingRemoteText &&
        currentText.includes(item.remainingRemoteText)
      ) {
        const insertPos =
          currentText.indexOf(item.remainingRemoteText) +
          item.remainingRemoteText.length
        textNode.insert(
          Math.min(insertPos, currentText.length),
          item.text
        )
      } else {
        textNode.insert(currentText.length, item.text)
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
       * 避免 ProseMirror command 层的 mismatched transaction。
       * 然后异步恢复被连带删除的远端内容。
       */
      safeUndo:
        () =>
        ({ tr, editor }) => {
          // 阻止 Tiptap 在命令执行后 dispatch 这个空 transaction
            // 我们直接调用 Yjs UndoManager.undo()，不经过 ProseMirror
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

          // 1. 快照远端文本内容
          const before = snapshotRemoteText(ydoc, localClientID)

            // 2. 直接调用 Yjs UndoManager.undo()
um.undo()

              // 3. 异步恢复丢失的远端内容
                setTimeout(() => {
              const after = snapshotRemoteText(ydoc, localClientID)
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
       * 安全 redo：同样直接调用 Yjs UndoManager.redo()。
       */
      safeRedo:
        () =>
        ({ tr, editor }) => {
          // 阻止 Tiptap 在命令执行后 dispatch 这个空 transaction
            tr.setMeta("preventDispatch", true)

          const collaborationExt = editor.extensionManager.extensions.find(
            (ext) => ext.name === "collaboration"
          )
if (!collaborationExt || !collaborationExt.options.document) {
          tr.setMeta("preventDispatch", false)
          return editor.commands.redo()
}

          const ydoc = collaborationExt.options.document
          const localClientID = ydoc.clientID

          const umState = yUndoPluginKey.getState(editor.view.state)
const um = umState ? umState.undoManager : null
          if (!um) {
tr.setMeta("preventDispatch", false)
          return editor.commands.redo()
}

            const before = snapshotRemoteText(ydoc, localClientID)

um.redo()

              setTimeout(() => {
                const after = snapshotRemoteText(ydoc, localClientID)
              const lost = findLostRemoteText(before, after)

          if (lost.length > 0) {
ydoc.transact(() => {
          restoreLostContent(ydoc, lost)
        }, ySyncPluginKey)
              }
            }, 0)

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
