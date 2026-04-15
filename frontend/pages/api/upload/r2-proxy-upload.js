import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import formidable from 'formidable';
import { createReadStream, unlinkSync } from 'fs';
import { assertR2Config, getR2Config } from '../../../lib/r2Server';

export const config = {
  api: { bodyParser: false },
};

/**
 * Same-origin upload → server → R2 (no browser CORS to R2).
 * Uses multipart streaming so large videos need not fit in RAM.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let cfg;
  try {
    cfg = getR2Config();
    assertR2Config(cfg);
  } catch (e) {
    return res.status(500).json({ error: 'R2 configuration is missing' });
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: true,
  });

  let tempPath = null;

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({
        maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
      });
      form.parse(req, (err, f, filez) => {
        if (err) return reject(err);
        resolve({ fields: f, files: filez });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    tempPath = file.filepath;

    const key = Array.isArray(fields.key) ? fields.key[0] : fields.key;
    if (!key) {
      try {
        unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
      tempPath = null;
      return res.status(400).json({ error: 'key field is required' });
    }

    const contentType = file.mimetype || 'application/octet-stream';
    const bodyStream = createReadStream(tempPath);

    const upload = new Upload({
      client,
      params: {
        Bucket: cfg.bucketName,
        Key: key,
        Body: bodyStream,
        ContentType: contentType,
      },
      // Larger parts + more concurrency = fewer round-trips to R2 for multi‑GB files
      queueSize: 8,
      partSize: 32 * 1024 * 1024, // 32 MiB parts (multipart; avoids tiny part storms)
      leavePartsOnError: false,
    });

    await upload.done();

    res.json({ success: true, key });
  } catch (error) {
    console.error('R2 proxy upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  } finally {
    if (tempPath) {
      try {
        unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }
}
