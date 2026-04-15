import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertR2Config,
  assertSafeObjectKey,
  createR2S3ClientForGetPresign,
  getR2Config,
} from '../../../lib/r2Server';

/** 6h expiry with client-side smart refresh before expiration. */
const PRESIGN_GET_EXPIRES_SEC = 6 * 60 * 60; // 6 hours

function getKeyFromRequest(req) {
  if (req.method === 'GET') {
    const raw = req.query.key;
    if (Array.isArray(raw)) return raw[0];
    return raw;
  }
  return req.body?.key;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cfg = getR2Config();
    assertR2Config(cfg);

    let key;
    try {
      key = getKeyFromRequest(req);
      assertSafeObjectKey(key);
    } catch (e) {
      return res.status(e.statusCode || 400).json({ error: e.message });
    }

    const s3Client = createR2S3ClientForGetPresign(cfg);

    const command = new GetObjectCommand({
      Bucket: cfg.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGN_GET_EXPIRES_SEC,
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    res.json({
      signedUrl,
      expiresIn: PRESIGN_GET_EXPIRES_SEC,
    });
  } catch (error) {
    console.error('R2 video URL error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      error: 'Failed to generate video URL',
      details: error.message,
    });
  }
}
