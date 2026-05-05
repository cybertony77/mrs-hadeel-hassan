import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

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

cloudinary.config({
  cloud_name: envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_FOLDERS = ['HW-PDFs', 'Quizs-PDFs', 'MockExams-PDFs', 'material'];
const CLOUDINARY_TIMEOUT_MS = 300000; // 5 minutes for slow networks/large payloads
const MAX_RETRY_COUNT = 2;

async function uploadPdfWithRetry(file, options) {
  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    try {
      return await cloudinary.uploader.upload(file, options);
    } catch (error) {
      lastError = error;
      const status = Number(error?.http_code || 0);
      const transient = !status || status >= 500 || status === 420 || status === 429;
      if (!transient || attempt === MAX_RETRY_COUNT) {
        throw error;
      }
      const waitMs = 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!req.body || !req.body.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { file, fileType, folder } = req.body;

    if (!fileType || fileType !== 'application/pdf') {
      return res.status(400).json({ error: 'Invalid file type. Only PDF files are allowed.' });
    }

    if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: 'Invalid upload folder.' });
    }

    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    let fileSize = 0;
    try {
      fileSize = Buffer.from(base64Data, 'base64').length;
    } catch {
      return res.status(400).json({ error: 'Invalid PDF payload encoding.' });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Max PDF file size is 20 MB.' });
    }

    const uploadResult = await uploadPdfWithRetry(file, {
      folder: folder,
      resource_type: 'raw',
      type: 'upload',
      overwrite: false,
      // No overwrite => invalidation is unnecessary and slows uploads.
      timeout: CLOUDINARY_TIMEOUT_MS,
    });

    res.status(200).json({
      success: true,
      url: uploadResult.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary PDF upload error:', error);

    if (error.http_code === 400) {
      return res.status(400).json({ error: error.message || 'Invalid PDF file.' });
    }

    if (error.http_code === 401 || error.http_code === 403) {
      return res.status(500).json({ error: 'Cloudinary authentication error. Please contact support.' });
    }

    const errorMessage = error.message || 'Failed to upload PDF. Please try again.';
    res.status(500).json({ error: errorMessage });
  }
}

export const config = {
  api: {
    bodyParser: {
      // 20MB binary PDF may exceed 30MB once base64 + JSON overhead are added.
      sizeLimit: '40mb',
    },
  },
};
