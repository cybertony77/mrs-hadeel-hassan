export function onlineItemTypeLabel(type) {
  const t = (type || '').trim();
  switch (t) {
    case 'questions':
      return 'Questions';
    case 'pdf':
      return 'PDF';
    case 'pages_from_book':
      return 'Pages from book';
    default:
      return t || '—';
  }
}

export function formatHomeworkPickerLabel(hw) {
  if (!hw) return '';
  const parts = [
    hw.lesson,
    hw.lesson_name,
    onlineItemTypeLabel(hw.homework_type),
    hw.course,
    (hw.courseType && String(hw.courseType).trim()) ? hw.courseType : null,
    (hw.center && String(hw.center).trim()) ? hw.center : null,
  ].filter(Boolean);
  return parts.join(' • ');
}

export function formatQuizPickerLabel(q) {
  if (!q) return '';
  const parts = [
    q.lesson,
    q.lesson_name,
    onlineItemTypeLabel(q.quiz_type),
    q.course,
    (q.courseType && String(q.courseType).trim()) ? q.courseType : null,
    (q.center && String(q.center).trim()) ? q.center : null,
  ].filter(Boolean);
  return parts.join(' • ');
}

export function formatMockExamPickerLabel(me) {
  if (!me) return '';
  const parts = [
    me.lesson,
    me.lesson_name,
    onlineItemTypeLabel(me.mock_exam_type),
    me.course,
    (me.courseType && String(me.courseType).trim()) ? me.courseType : null,
    (me.center && String(me.center).trim()) ? me.center : null,
  ].filter(Boolean);
  return parts.join(' • ');
}
