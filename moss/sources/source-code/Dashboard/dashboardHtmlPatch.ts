export const AI_BLOCK_ID_PREFIX = 'ai-block-';
const AI_BLOCK_SELECTOR = `[id^="${AI_BLOCK_ID_PREFIX}"]`;

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function collectAiBlocks(doc: Document): Map<string, HTMLElement> | null {
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>(AI_BLOCK_SELECTOR));
  if (blocks.length === 0) return null;

  const byId = new Map<string, HTMLElement>();
  for (const block of blocks) {
    if (!block.id || byId.has(block.id)) return null;
    byId.set(block.id, block);
  }
  return byId;
}

/**
 * 判断两份累计快照 HTML 是否只有 AI block 的内容发生变化。
 *
 * partial/final 是完整累计快照，不能因为页面里存在 ai-block 就跳过其它业务区更新。
 * 这里会清空相同 AI block 的内容后比较整份文档；外层属性、普通业务 DOM、脚本或样式
 * 只要有任何变化，都必须回退到 iframe srcdoc 完整导航。
 */
export function isStrictlyAiOnlyHtmlUpdate(previousHtml: string, nextHtml: string): boolean {
  try {
    const previousDoc = parseHtml(previousHtml);
    const nextDoc = parseHtml(nextHtml);
    const previousBlocks = collectAiBlocks(previousDoc);
    const nextBlocks = collectAiBlocks(nextDoc);
    if (!previousBlocks || !nextBlocks || previousBlocks.size !== nextBlocks.size) return false;

    let aiContentChanged = false;
    for (const [id, previousBlock] of previousBlocks) {
      const nextBlock = nextBlocks.get(id);
      if (!nextBlock) return false;
      if (previousBlock.innerHTML !== nextBlock.innerHTML) aiContentChanged = true;
      previousBlock.replaceChildren(previousDoc.createTextNode(`__MOSS_AI_BLOCK_${id}__`));
      nextBlock.replaceChildren(nextDoc.createTextNode(`__MOSS_AI_BLOCK_${id}__`));
    }

    return aiContentChanged && previousDoc.documentElement.outerHTML === nextDoc.documentElement.outerHTML;
  } catch {
    return false;
  }
}

/** 仅在调用方已经确认是严格 AI-only 更新后执行。 */
export function patchAiBlocks(doc: Document, nextHtml: string): boolean {
  try {
    const nextDoc = parseHtml(nextHtml);
    const nextBlocks = collectAiBlocks(nextDoc);
    if (!nextBlocks) return false;

    const patches: Array<{ target: HTMLElement; html: string }> = [];
    for (const [id, nextBlock] of nextBlocks) {
      const target = doc.getElementById(id);
      // iframe Element 属于另一个 Window，不能使用父窗口的 instanceof HTMLElement 判断。
      if (!target) return false;
      patches.push({ target: target as HTMLElement, html: nextBlock.innerHTML });
    }

    for (const { target, html } of patches) {
      if (target.innerHTML !== html) target.innerHTML = html;
    }
    return true;
  } catch {
    return false;
  }
}
