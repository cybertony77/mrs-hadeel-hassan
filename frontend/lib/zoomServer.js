import fs from 'fs';
import path from 'path';

function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      let value = trimmed.substring(index + 1).trim();
      value = value.replace(/^"|"$/g, '');
      envVars[key] = value;
    });

    return envVars;
  } catch {
    return {};
  }
}

const envConfig = loadEnvConfig();
const ZOOM_CLIENT_ID = envConfig.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = envConfig.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET;
const ZOOM_ACCOUNT_ID = envConfig.ZOOM_ACCOUNT_ID || process.env.ZOOM_ACCOUNT_ID;
const ZOOM_ACCESS_TOKEN = envConfig.ZOOM_ACCESS_TOKEN || process.env.ZOOM_ACCESS_TOKEN;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function ensureZoomEnv() {
  if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET || !ZOOM_ACCOUNT_ID) {
    throw new Error('Zoom configuration is missing');
  }
}

export async function getZoomAccessToken(forceRefresh = false) {
  ensureZoomEnv();

  const now = Date.now();
  const hasValidCachedToken =
    !forceRefresh &&
    cachedToken &&
    cachedTokenExpiresAt > now + 30 * 1000;

  if (hasValidCachedToken) {
    return cachedToken;
  }

  const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
  const tokenUrl =
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const message = payload?.reason || payload?.message || 'Failed to generate Zoom token';
    const err = new Error(message);
    err.statusCode = response.status || 502;
    throw err;
  }

  const expiresIn = Number(payload.expires_in || 3600);
  cachedToken = payload.access_token;
  cachedTokenExpiresAt = now + expiresIn * 1000;

  return cachedToken;
}

export async function getZoomMeetingMp4DownloadUrl(meetingId, forceRefresh = false) {
  if (!meetingId || !String(meetingId).trim()) {
    const err = new Error('Meeting ID is required');
    err.statusCode = 400;
    throw err;
  }

  const token = await getZoomAccessToken(forceRefresh);
  const response = await fetch(
    `https://api.zoom.us/v2/meetings/${encodeURIComponent(String(meetingId).trim())}/recordings`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    const err = new Error('Zoom token expired');
    err.statusCode = 401;
    throw err;
  }

  if (!response.ok) {
    const message = payload?.message || 'Zoom API failure';
    const err = new Error(message);
    err.statusCode = response.status || 502;
    throw err;
  }

  const files = Array.isArray(payload?.recording_files) ? payload.recording_files : [];
  const mp4File = files.find((file) => {
    const fileType = String(file?.file_type || '').toUpperCase();
    const status = String(file?.status || '').toLowerCase();
    return fileType === 'MP4' && (!status || status === 'completed');
  });

  if (!mp4File?.download_url) {
    const err = new Error('No MP4 recording found for this meeting');
    err.statusCode = 404;
    throw err;
  }

  return {
    downloadUrl: mp4File.download_url,
    recordingFileId: mp4File.id || null,
  };
}

const ZOOM_LIST_FETCH_MS = 60_000;

export async function listZoomUserRecordings(nextPageToken = '', forceRefresh = false) {
  const staticToken = ZOOM_ACCESS_TOKEN && String(ZOOM_ACCESS_TOKEN).trim()
    ? String(ZOOM_ACCESS_TOKEN).trim()
    : '';
  // After a 401, callers pass forceRefresh: use OAuth so a stale env token does not loop forever.
  const token =
    staticToken && !forceRefresh ? staticToken : await getZoomAccessToken(forceRefresh);
  const safeNextPageToken = String(nextPageToken || '').trim();
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);

  const url = new URL('https://api.zoom.us/v2/users/me/recordings');
  url.searchParams.set('page_size', '30');
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  if (safeNextPageToken) {
    url.searchParams.set('next_page_token', safeNextPageToken);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZOOM_LIST_FETCH_MS);

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('Zoom recordings request timed out. Try again or use a smaller date range.');
      err.statusCode = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    const err = new Error('Zoom token expired');
    err.statusCode = 401;
    throw err;
  }

  if (!response.ok) {
    const message = payload?.message || 'Zoom API failure';
    const err = new Error(message);
    err.statusCode = response.status || 502;
    err.details = payload;
    throw err;
  }

  return {
    ...payload,
    _resolved_access_token: token,
  };
}
