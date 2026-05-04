import { authMiddleware } from '../../../lib/authMiddleware';
import { listZoomUserRecordings } from '../../../lib/zoomServer';

function formatDateTime(dateString, timezone) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const normalizedTimezone = String(timezone || '').trim();
  const safeTimezone =
    normalizedTimezone && normalizedTimezone !== 'UTC'
      ? normalizedTimezone
      : 'Africa/Cairo';

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: safeTimezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const getPart = (type) => parts.find((part) => part.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const dayPeriod = (getPart('dayPeriod') || '').toUpperCase();

    return `${day}/${month}/${year} at ${hour}:${minute} ${dayPeriod}`;
  } catch {
    // Fallback to UTC if provided timezone is invalid.
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const getPart = (type) => parts.find((part) => part.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const dayPeriod = (getPart('dayPeriod') || '').toUpperCase();

    return `${day}/${month}/${year} at ${hour}:${minute} ${dayPeriod}`;
  }
}

function formatDuration(durationMinutes) {
  const total = Number(durationMinutes || 0);
  const safe = Number.isFinite(total) ? Math.max(0, total) : 0;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}h:${String(mins).padStart(2, '0')}m`;
}

function resolveMeetingDate(meeting) {
  const files = Array.isArray(meeting?.recording_files) ? meeting.recording_files : [];
  return (
    meeting?.created_at ||
    meeting?.start_time ||
    files[0]?.recording_start ||
    null
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authMiddleware(req);
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const nextPageToken = String(req.query.next_page_token || '');

    let payload;
    try {
      payload = await listZoomUserRecordings(nextPageToken);
    } catch (error) {
      if (error?.statusCode === 401) {
        payload = await listZoomUserRecordings(nextPageToken, true);
      } else {
        throw error;
      }
    }

    const meetings = Array.isArray(payload?.meetings) ? payload.meetings : [];
    const mapped = meetings.map((meeting) => ({
      ...(meeting || {}),
      uuid: meeting.uuid || '',
      id: meeting.id || null,
      topic: meeting.topic || '',
      start_time: meeting.start_time || null,
      duration: meeting.duration || 0,
      timezone: meeting.timezone || null,
      created_at: resolveMeetingDate(meeting),
      recording_files: Array.isArray(meeting.recording_files) ? meeting.recording_files : [],
      created_at_formated: formatDateTime(resolveMeetingDate(meeting), meeting.timezone),
      duration_furmated: formatDuration(meeting.duration),
    }));

    return res.json({
      meetings: mapped,
      next_page_token: payload?.next_page_token || '',
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    if (statusCode === 401) {
      return res.status(401).json({ error: 'Zoom token expired' });
    }
    const details = error?.message || 'Unknown error';
    const missingScope = details.includes('does not contain scopes');
    return res.status(statusCode).json({
      error: 'Failed to fetch zoom recordings',
      details,
      hint: missingScope
        ? 'Your Zoom app token is missing recording scopes. Add cloud recording read/list scopes in Zoom Marketplace app settings, then regenerate token.'
        : undefined,
      zoom: error?.details || null,
    });
  }
}
