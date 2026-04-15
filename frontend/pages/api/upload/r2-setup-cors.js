import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import {
  assertR2Config,
  buildR2CorsAllowedOrigins,
  getR2Config,
} from '../../../lib/r2Server';

/**
 * Manual CORS apply (same rules as auto-apply in r2-signed-url).
 * POST /api/upload/r2-setup-cors — optional if presigned-url flow already ran.
 *
 * Optional env: R2_CORS_ORIGINS = comma-separated origins
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cfg = getR2Config();
    assertR2Config(cfg);

    const allowedOrigins = buildR2CorsAllowedOrigins(cfg.envConfig || {});

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: true,
    });

    const command = new PutBucketCorsCommand({
      Bucket: cfg.bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            // S3/R2 CORS schema does not accept OPTIONS in AllowedMethods.
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: allowedOrigins,
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    });

    await s3Client.send(command);

    res.json({
      success: true,
      message:
        'CORS applied to R2 bucket. Browser PUT uploads should work from these origins:',
      allowedOrigins,
    });
  } catch (error) {
    console.error('R2 CORS setup error:', error);
    res.status(500).json({ error: 'Failed to configure CORS', details: error.message });
  }
}
