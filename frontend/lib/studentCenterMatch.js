/**
 * If an online item (homework / quiz / mock exam) has a non-empty center,
 * it is only visible when it matches the student's main_center (case-insensitive).
 * Empty center on the item → visible to all (still subject to course/courseType rules elsewhere).
 * Non-empty center but empty student main_center → not visible.
 */
export function itemCenterMatchesStudentMainCenter(itemCenterRaw, studentMainCenterRaw) {
  const itemCenter = (itemCenterRaw || '').trim();
  if (!itemCenter) return true;
  const studentCenter = (studentMainCenterRaw || '').trim();
  if (!studentCenter) return false;
  return itemCenter.toLowerCase() === studentCenter.toLowerCase();
}

/**
 * Client-side list filter: when the session profile has no `main_center` (not merged from `students`
 * yet, or still loading), do not hide items — `/api/.../student` already enforced center rules.
 */
export function clientItemVisibleByCenter(itemCenterRaw, profileMainCenterRaw) {
  if (!String(profileMainCenterRaw ?? '').trim()) return true;
  return itemCenterMatchesStudentMainCenter(itemCenterRaw, profileMainCenterRaw);
}
