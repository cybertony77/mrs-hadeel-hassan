/**
 * Duplicate key for homeworks / quizzes / mock exams: same course + courseType + lesson
 * must also match center. Null, missing, and '' count as "no center".
 */

/** @returns {Record<string, unknown>} Mongo filter fragment for `center` */
export function duplicateCenterMongoFragment(centerTrimmed) {
  const s =
    centerTrimmed != null && String(centerTrimmed).trim() !== ''
      ? String(centerTrimmed).trim()
      : null;
  if (s != null && s !== '') {
    return { center: s };
  }
  return {
    $or: [{ center: null }, { center: { $exists: false } }, { center: '' }],
  };
}

/** Client-side: two center values represent the same slot for duplicate checks */
export function centersMatchDuplicateClient(a, b) {
  const n = (x) => (x == null || String(x).trim() === '' ? '' : String(x).trim());
  return n(a) === n(b);
}
