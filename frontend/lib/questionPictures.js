/**
 * Extra indexed image fields from Mongo: question_picture_2, question_picture_3, ...
 */
export function pickQuestionPictureFields(q) {
  if (!q || typeof q !== 'object') return {};
  return Object.keys(q)
    .filter((key) => /^question_picture_\d+$/.test(key))
    .reduce((acc, key) => ({ ...acc, [key]: q[key] || null }), {});
}

/** Ordered list of Cloudinary public_ids for display (primary + indexed fields). */
export function listQuestionPicturePublicIds(question) {
  if (!question || typeof question !== 'object') return [];
  const pictures = [];
  const primary = question.question_image || question.question_picture;
  pictures[0] = primary || null;
  Object.keys(question)
    .filter((key) => /^question_picture_\d+$/.test(key))
    .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
    .forEach((key) => {
      const idx = Number(key.split('_').pop()) - 1;
      if (idx >= 1) pictures[idx] = question[key] || null;
    });
  return pictures.filter((p) => p != null && String(p).trim() !== '');
}
