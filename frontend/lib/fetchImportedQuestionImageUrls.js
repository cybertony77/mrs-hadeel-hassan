/**
 * Fetches signed URLs for question images; returns a map keyed `${qIdx}_${imageIdx}`.
 * @param {'homeworks'|'quizzes'|'online_mock_exams'} apiSegment
 */
export async function fetchImportedQuestionImageUrls(questions, apiSegment, apiClient) {
  const map = {};
  if (!questions?.length || !apiClient) return map;

  for (let qIdx = 0; qIdx < questions.length; qIdx++) {
    const q = questions[qIdx];
    const pictures = [];
    pictures[0] = q?.question_picture || null;
    Object.keys(q || {})
      .filter((key) => /^question_picture_\d+$/.test(key))
      .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
      .forEach((key) => {
        const pictureIndex = Number(key.split('_').pop()) - 1;
        if (pictureIndex >= 1) pictures[pictureIndex] = q[key] || null;
      });

    for (let imageIdx = 0; imageIdx < pictures.length; imageIdx++) {
      const publicId = pictures[imageIdx];
      if (!publicId) continue;
      const imageKey = `${qIdx}_${imageIdx}`;
      try {
        const res = await apiClient.get(
          `/api/${apiSegment}/image?public_id=${encodeURIComponent(publicId)}`
        );
        if (res.data?.url) map[imageKey] = res.data.url;
      } catch {
        // ignore per-image failures
      }
    }
  }
  return map;
}
