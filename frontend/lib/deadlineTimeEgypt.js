/**
 * Deadline date + optional time ("04:30 AM") interpreted in Africa/Cairo (UTC+2, no DST).
 */

export const EGYPT_UTC_OFFSET_HOURS = 2;

/**
 * Normalize stored deadline_date to YYYY-MM-DD (civil date) for Egypt math.
 * Mongo / JSON often send "2026-05-02T00:00:00.000Z" which must not fail strict date-only parsing.
 */
export function normalizeDeadlineDateYmd(deadlineDate) {
  if (deadlineDate == null || deadlineDate === '') return null;
  let raw = deadlineDate;
  if (typeof raw === 'object' && raw !== null && '$date' in raw) {
    raw = raw.$date;
  }
  const s = String(raw).trim();
  const prefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) return prefix[1];
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !mo || !d) return null;
  return `${y}-${mo}-${d}`;
}

export function hour12To24(h12, period) {
  const h = Number(h12);
  if (Number.isNaN(h) || h < 1 || h > 12) return null;
  const p = String(period || '').toUpperCase();
  if (p === 'AM') return h === 12 ? 0 : h;
  if (p === 'PM') return h === 12 ? 12 : h + 12;
  return null;
}

/** Parse "04:30 AM" / "4:30 pm" / "04:30:00 PM" -> { hour12, minute } or null */
export function parseDeadlineTime(str) {
  if (str == null) return null;
  let s = typeof str === 'string' ? str : String(str);
  s = s
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\u202f/g, ' ')
    .replace(/\s+/g, ' ');
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (!m) return null;
  const hour12 = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  return { hour12, minute, period };
}

/** Build "04:30 AM" from parts; null if incomplete / invalid */
export function formatDeadlineTimeFromParts(hourStr, minuteStr, period) {
  const hs = String(hourStr ?? '').replace(/\D/g, '').slice(0, 2);
  const ms = String(minuteStr ?? '').replace(/\D/g, '').slice(0, 2);
  const p = String(period || '').toUpperCase();
  if (!hs || !ms || (p !== 'AM' && p !== 'PM')) return null;
  const h = parseInt(hs, 10);
  const m = parseInt(ms, 10);
  if (Number.isNaN(h) || h < 1 || h > 12 || Number.isNaN(m) || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
}

/**
 * UTC ms for end of deadline: if time given, that clock in Cairo; else end of that calendar day in Cairo.
 */
export function getDeadlineEndUtcMs(deadlineDateYmd, deadlineTimeStr) {
  const ymd = normalizeDeadlineDateYmd(deadlineDateYmd);
  if (!ymd) return null;
  const [y, mo, d] = ymd.split('-').map(Number);
  const parsed = deadlineTimeStr ? parseDeadlineTime(String(deadlineTimeStr)) : null;
  const off = EGYPT_UTC_OFFSET_HOURS;
  if (parsed) {
    const h24 = hour12To24(parsed.hour12, parsed.period);
    if (h24 === null) return null;
    return Date.UTC(y, mo - 1, d, h24 - off, parsed.minute, 0, 0);
  }
  return Date.UTC(y, mo - 1, d, 23 - off, 59, 59, 999);
}

/** Cairo "now" parts (civil date + 24h clock) for Africa/Cairo. */
function getCairoNowParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(new Date());
  const pick = (t) => {
    const p = parts.find((x) => x.type === t);
    return p ? parseInt(p.value, 10) : 0;
  };
  return {
    y: pick('year'),
    mo: pick('month'),
    d: pick('day'),
    h: pick('hour'),
    min: pick('minute'),
    s: pick('second'),
  };
}

/**
 * True if current instant is past the deadline in Africa/Cairo (same meaning as admin "deadline date + time").
 * Uses Intl for "now" so it matches Cairo wall clock even if the student's PC timezone differs.
 */
export function isDeadlinePassedEgypt(deadlineDateYmd, deadlineTimeStr) {
  const ymd = normalizeDeadlineDateYmd(deadlineDateYmd);
  if (!ymd) return false;
  const [dy, dmo, dd] = ymd.split('-').map(Number);
  const n = getCairoNowParts();

  if (n.y > dy) return true;
  if (n.y < dy) return false;
  if (n.mo > dmo) return true;
  if (n.mo < dmo) return false;
  if (n.d > dd) return true;
  if (n.d < dd) return false;

  // Same calendar day in Cairo
  const parsed = deadlineTimeStr ? parseDeadlineTime(String(deadlineTimeStr)) : null;
  if (!parsed) {
    // Date-only: active through end of that Cairo day (not "passed" until next Cairo midnight).
    return false;
  }
  const h24 = hour12To24(parsed.hour12, parsed.period);
  if (h24 === null) return false;
  const deadlineSec = h24 * 3600 + parsed.minute * 60;
  const nowSec = n.h * 3600 + n.min * 60 + n.s;
  return nowSec > deadlineSec;
}

export function isDeadlineStrictlyInFutureEgypt(deadlineDateYmd, deadlineTimeStr) {
  const end = getDeadlineEndUtcMs(deadlineDateYmd, deadlineTimeStr);
  if (end == null) return false;
  return end > Date.now();
}

/** Card line: "With deadline date : MM/DD/YYYY at 04:30 AM" (civil date from stored value, same as deadline math). */
export function formatDeadlineCardLabel(deadline_date, deadline_time) {
  if (!deadline_date) return '';
  const ymd = normalizeDeadlineDateYmd(deadline_date);
  if (!ymd) return '';
  const [y, mo, d] = ymd.split('-');
  const part = `${mo}/${d}/${y}`;
  const t = deadline_time && String(deadline_time).trim();
  if (t) return `With deadline date : ${part} at ${t}`;
  return `With deadline date : ${part}`;
}

/** Server/client: normalize body field to string or null */
export function normalizeDeadlineTimeField(deadline_type, raw) {
  if (deadline_type !== 'with_deadline') return null;
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  return parseDeadlineTime(s) ? s : null;
}

/** YYYY-MM-DD for "today" in Africa/Cairo (for date input min, etc.) */
export function getEgyptYmdToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) return new Date().toISOString().split('T')[0];
  return `${y}-${m}-${d}`;
}
