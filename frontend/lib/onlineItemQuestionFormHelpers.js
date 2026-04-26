/**
 * Stable row id for question lists (React keys). Stripped before API submit.
 */
export function newQuestionClientKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * `q_idx` composite keys (parse with lastIndexOf) — shift q after a question row is removed.
 */
export function reindexCompositeKeysAfterQuestionRemoved(prev, removedQuestionIndex) {
  const ri = Number(removedQuestionIndex);
  if (Number.isNaN(ri) || ri < 0) return { ...prev };
  const next = {};
  for (const [key, val] of Object.entries(prev)) {
    const lastUs = key.lastIndexOf('_');
    if (lastUs <= 0) {
      next[key] = val;
      continue;
    }
    const q = Number(key.slice(0, lastUs));
    const idx = Number(key.slice(lastUs + 1));
    if (Number.isNaN(q) || Number.isNaN(idx)) {
      next[key] = val;
      continue;
    }
    if (q === ri) continue;
    if (q > ri) {
      next[`${q - 1}_${idx}`] = val;
    } else {
      next[key] = val;
    }
  }
  return next;
}

/**
 * Re-key errors like question_0_text, question_1_image_0 after removing a question row.
 */
export function reindexQuestionErrorsAfterQuestionRemoved(prev, removedQuestionIndex) {
  const ri = Number(removedQuestionIndex);
  if (Number.isNaN(ri) || ri < 0) return { ...prev };
  const next = { ...prev };
  const prefix = `question_${ri}_`;
  Object.keys(next).forEach((k) => {
    if (k.startsWith(prefix)) delete next[k];
  });
  const movers = Object.keys(next)
    .map((k) => {
      const m = k.match(/^question_(\d+)_(.+)$/);
      if (!m) return null;
      const q = Number(m[1]);
      if (Number.isNaN(q) || q <= ri) return null;
      return { k, q, rest: m[2] };
    })
    .filter(Boolean)
    .sort((a, b) => b.q - a.q);
  for (const { k, q, rest } of movers) {
    const v = next[k];
    delete next[k];
    next[`question_${q - 1}_${rest}`] = v;
  }
  return next;
}

export function reindexDragOverAfterQuestionRemoved(dragOverIndex, removedQuestionIndex) {
  const ri = Number(removedQuestionIndex);
  if (Number.isNaN(ri) || dragOverIndex == null || dragOverIndex === '') return dragOverIndex;
  const key = String(dragOverIndex);
  const lastUs = key.lastIndexOf('_');
  if (lastUs <= 0) return dragOverIndex;
  const q = Number(key.slice(0, lastUs));
  const idx = Number(key.slice(lastUs + 1));
  if (Number.isNaN(q) || Number.isNaN(idx)) return dragOverIndex;
  if (q === ri) return null;
  if (q > ri) return `${q - 1}_${idx}`;
  return dragOverIndex;
}
