import { authMiddleware } from '../../../lib/authMiddleware';
import { listZoomUserRecordings } from '../../../lib/zoomServer';

function formatDateTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${day}/${month}/${year} at ${hoursStr}:${minutes} ${ampm}`;
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
      created_at_formated: formatDateTime(resolveMeetingDate(meeting)),
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
