import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { getZoomAccessToken, getZoomMeetingMp4DownloadUrl } from '../../../lib/zoomServer';
import { Readable } from 'stream';

// Disable Next.js body parsing — we stream raw bytes
export const config = {
  api: {
    responseLimit: false,
  },
};

// ─── Load env.config ──────────────────────────────────────────────────────────

function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, '');
          envVars[key] = value;
        }
      }
    });

    return envVars;
  } catch (error) {
    console.log('Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const accountId = envConfig.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = envConfig.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = envConfig.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const bucketName = envConfig.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
});

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({
    httpAgent,
    httpsAgent,
  }),
});

// ─── Content-Type mapping ─────────────────────────────────────────────────────

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
};

function getContentType(key) {
  const lower = key.toLowerCase();
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (lower.endsWith(ext)) return mime;
  }
  return 'application/octet-stream';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Only GET and HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  try {
    await authMiddleware(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Build key from catch-all segments ────────────────────────────────────
  const { key } = req.query; // key is an array of path segments
  if (!key || key.length === 0) {
    return res.status(400).json({ error: 'Video key is required' });
  }
  const routeParts = Array.isArray(key) ? key : [key];

  const isZoomByPrefix = routeParts[0] === 'zoom';
  const isZoomByMeetingIdRoute = routeParts.length === 1 && /^[0-9]+$/.test(String(routeParts[0]));

  // Zoom routes:
  // - /api/videos/{meetingId}
  // - /api/videos/zoom/{meetingId}
  if (isZoomByPrefix || isZoomByMeetingIdRoute) {
    const meetingId = isZoomByPrefix ? routeParts.slice(1).join('/') : routeParts[0];
    if (!meetingId) {
      return res.status(400).json({ error: 'Zoom meeting ID is required' });
    }

    try {
      let recordingInfo;
      try {
        recordingInfo = await getZoomMeetingMp4DownloadUrl(meetingId);
      } catch (err) {
        if (err?.statusCode === 401) {
          recordingInfo = await getZoomMeetingMp4DownloadUrl(meetingId, true);
        } else {
          throw err;
        }
      }

      let token;
      try {
        token = await getZoomAccessToken();
      } catch {
        token = await getZoomAccessToken(true);
      }

      const upstreamHeaders = {
        Authorization: `Bearer ${token}`,
      };
      if (req.headers.range) {
        upstreamHeaders.Range = req.headers.range;
      }

      let zoomVideoResponse = await fetch(recordingInfo.downloadUrl, {
        method: req.method,
        headers: upstreamHeaders,
      });

      if (zoomVideoResponse.status === 401) {
        const freshToken = await getZoomAccessToken(true);
        const retryHeaders = {
          Authorization: `Bearer ${freshToken}`,
        };
        if (req.headers.range) {
          retryHeaders.Range = req.headers.range;
        }
        zoomVideoResponse = await fetch(recordingInfo.downloadUrl, {
          method: req.method,
          headers: retryHeaders,
        });
      }

      if (!zoomVideoResponse.ok) {
        if (zoomVideoResponse.status === 404) {
          return res.status(404).json({ error: 'No recording found for this meeting' });
        }
        if (zoomVideoResponse.status === 401) {
          return res.status(401).json({ error: 'Zoom token expired' });
        }
        return res.status(502).json({ error: 'Zoom video streaming failed' });
      }

      const headersToForward = [
        'content-range',
        'accept-ranges',
        'content-length',
        'last-modified',
        'etag',
      ];
      headersToForward.forEach((header) => {
        const value = zoomVideoResponse.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.statusCode = zoomVideoResponse.status;

      if (req.method === 'HEAD') {
        return res.end();
      }

      if (!zoomVideoResponse.body) {
        return res.status(502).json({ error: 'Zoom API returned empty stream' });
      }

      const stream = Readable.fromWeb(zoomVideoResponse.body);
      const cleanup = () => {
        try {
          if (stream && typeof stream.destroy === 'function') stream.destroy();
        } catch (_) {}
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);
      stream.on('end', cleanup);
      stream.on('close', cleanup);
      stream.on('error', () => {
        cleanup();
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      stream.pipe(res);
      return;
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      if (statusCode === 404) {
        return res.status(404).json({ error: 'No recording found for this meeting' });
      }
      if (statusCode === 401) {
        return res.status(401).json({ error: 'Zoom token expired' });
      }
      if (statusCode === 400) {
        return res.status(400).json({ error: error.message || 'Invalid meeting ID' });
      }
      return res.status(502).json({
        error: 'Zoom API failure',
        details: error?.message || 'Failed to stream Zoom recording',
      });
    }
  }

  // ── R2 config check ──────────────────────────────────────────────────────
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return res.status(500).json({ error: 'R2 configuration is missing' });
  }

  // R2 route: /api/videos/videos/1234_abc_file.mp4 => key = "videos/1234_abc_file.mp4"
  const objectKey = routeParts.join('/');
  console.log('Streaming:', objectKey);

  try {
    req.setTimeout(30000);
    res.setTimeout(30000);
    const rangeHeader = req.headers.range;

    // ── If Range request: fetch just that range ────────────────────────────
    if (rangeHeader) {
      // First, get object metadata to know total size
      const headCmd = new HeadObjectCommand({ Bucket: bucketName, Key: objectKey });
      let headResult;
      try {
        headResult = await client.send(headCmd);
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return res.status(404).json({ error: 'Video not found' });
        }
        throw err;
      }

      const totalSize = headResult.ContentLength;
      const contentType = headResult.ContentType || getContentType(objectKey);

      // Parse "bytes=START-END"
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      let start, end;
      if (match[1] !== '' && match[2] !== '') {
        start = parseInt(match[1], 10);
        end = parseInt(match[2], 10);
      } else if (match[1] !== '') {
        start = parseInt(match[1], 10);
        // Serve a chunk: min of 5 MB or rest of file
        end = Math.min(start + 5 * 1024 * 1024 - 1, totalSize - 1);
      } else if (match[2] !== '') {
        // bytes=-N  →  last N bytes
        const suffix = parseInt(match[2], 10);
        start = Math.max(0, totalSize - suffix);
        end = totalSize - 1;
      } else {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      // Clamp
      if (start >= totalSize || end >= totalSize) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;

      // Fetch the range from R2
      const getCmd = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Range: `bytes=${start}-${end}`,
      });
      const getResult = await client.send(getCmd);

      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': chunkSize,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        // Do not cache authenticated streams — stale cached chunks break Range playback after TTL / tab backgrounding
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        Vary: 'Cookie',
      });

      // Stream the body
      if (req.method === 'HEAD') {
        return res.end();
      }

      const stream = getResult.Body;
      const cleanup = () => {
        try {
          if (stream && typeof stream.destroy === 'function') stream.destroy();
        } catch (_) {}
      };
      req.on('close', cleanup);
      req.on('aborted', cleanup);
      stream.pipe(res);
      stream.on('end', cleanup);
      stream.on('close', cleanup);
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        cleanup();
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      });

    } else {
      // ── Full request (no Range) ──────────────────────────────────────────
      const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
      let getResult;
      try {
        getResult = await client.send(getCmd);
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return res.status(404).json({ error: 'Video not found' });
        }
        throw err;
      }

      const contentType = getResult.ContentType || getContentType(objectKey);
      const contentLength = getResult.ContentLength;

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': contentLength,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        Vary: 'Cookie',
      });

      if (req.method === 'HEAD') {
        return res.end();
      }

      const stream = getResult.Body;
      const cleanup = () => {
        try {
          if (stream && typeof stream.destroy === 'function') stream.destroy();
        } catch (_) {}
      };
      req.on('close', cleanup);
      req.on('aborted', cleanup);
      stream.pipe(res);
      stream.on('end', cleanup);
      stream.on('close', cleanup);
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        cleanup();
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      });
    }
  } catch (error) {
    console.error('Video streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream video' });
    }
  }
}
