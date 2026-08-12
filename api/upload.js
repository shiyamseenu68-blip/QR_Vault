import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';

const isVercel = Boolean(process.env.VERCEL);
const BASE_DIR = isVercel ? '/tmp' : process.cwd();
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'files.json');

// Ensure base directories exist
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf-8');
  }
} catch (e) {
  console.error('[UPLOAD.JS INIT ERROR]', e);
}

// Cloud storage helpers
async function uploadFileToCloud(fileBuffer, fileName, mimeType) {
  try {
    const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '72h');
    formData.append('fileToUpload', blob, fileName || 'file');

    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x86) QRVault/1.0',
      },
      body: formData,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const url = (await res.text()).trim();
      if (url.startsWith('http')) {
        return url;
      }
    }
  } catch (e) {
    console.warn('[CLOUD FILE UPLOAD WARN]', e?.message || String(e));
  }
  return null;
}

async function saveMetaToCloud(record) {
  try {
    const jsonStr = JSON.stringify(record);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '72h');
    formData.append('fileToUpload', blob, 'metadata.json');

    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x86) QRVault/1.0',
      },
      body: formData,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const url = (await res.text()).trim();
      if (url.startsWith('http')) {
        const metaCode = url.split('/').pop();
        return metaCode ? metaCode.replace('.json', '') : null;
      }
    }
  } catch (e) {
    console.warn('[CLOUD META SAVE WARN]', e?.message || String(e));
  }
  return null;
}

// Database helpers
function readDB() {
  if (globalThis._filesDB) {
    return globalThis._filesDB;
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const records = JSON.parse(data);
      globalThis._filesDB = records;
      return records;
    }
  } catch (err) {
    console.error('[DB READ ERROR]', err);
  }
  globalThis._filesDB = [];
  return globalThis._filesDB;
}

function writeDB(records) {
  globalThis._filesDB = records;
  try {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[DB WRITE WARN]', err);
  }
}

function generateSecureId(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function getCategory(mimeType, filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext) ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('office')
  ) {
    return 'document';
  }
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) ||
    mimeType.includes('zip') ||
    mimeType.includes('compressed')
  ) {
    return 'archive';
  }
  if (
    mimeType.startsWith('text/') ||
    ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'csv', 'xml', 'py', 'java', 'c', 'cpp'].includes(ext)
  ) {
    return 'text';
  }
  return 'other';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const app = express();

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Owner-Token, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// IMPORTANT: Do NOT use global body parsers when using multer
// Body parsers will consume the request stream before multer can process it
// Only use body parsers for routes that don't handle file uploads

// Upload endpoint - IMPORTANT: multer middleware BEFORE route handler
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received in request' });
    }

    const originalName = req.file.originalname || 'unnamed_file';
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const size = req.file.size || 0;

    if (size === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty (0 bytes)' });
    }

    const ownerToken = generateSecureId(24);
    const createdAt = Date.now();
    const category = getCategory(mimeType, originalName);

    const base64Data = size < 3 * 1024 * 1024 ? req.file.buffer.toString('base64') : undefined;

    let fileRemoteUrl = undefined;
    try {
      fileRemoteUrl = (await uploadFileToCloud(req.file.buffer, originalName, mimeType)) || undefined;
    } catch (e) {
      console.warn('[UPLOAD STORAGE WARN]', e?.message || String(e));
    }

    const expirationOpt = req.body?.expiration || 'never';
    let expiresAt = null;
    if (expirationOpt === '10m') expiresAt = createdAt + 10 * 60 * 1000;
    else if (expirationOpt === '1h') expiresAt = createdAt + 60 * 60 * 1000;
    else if (expirationOpt === '24h') expiresAt = createdAt + 24 * 60 * 60 * 1000;
    else if (expirationOpt === '7d') expiresAt = createdAt + 7 * 24 * 60 * 60 * 1000;
    else if (expirationOpt === '30d') expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000;

    const limitOpt = req.body?.downloadLimit;
    let downloadLimit = null;
    if (limitOpt && limitOpt !== 'unlimited') {
      const parsed = parseInt(limitOpt, 10);
      if (!isNaN(parsed) && parsed > 0) downloadLimit = parsed;
    }

    const requireConfirmation =
      req.body?.requireConfirmation === 'true' || req.body?.requireConfirmation === true;

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempId = generateSecureId(8);
    const storagePath = path.join(UPLOADS_DIR, `${tempId}_${safeName}`);
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      fs.writeFileSync(storagePath, req.file.buffer);
    } catch (e) {
      console.warn('[UPLOAD STORAGE WARN]', e?.message || String(e));
    }

    const initialRecord = {
      id: `TEMP_${tempId}`,
      originalName,
      mimeType,
      size,
      createdAt,
      expiresAt,
      downloadLimit,
      downloadCount: 0,
      requireConfirmation,
      isExpired: false,
      isDeleted: false,
      category,
      ownerToken,
      storagePath,
      base64Data,
      fileRemoteUrl,
    };

    let metaCode = null;
    try {
      metaCode = await saveMetaToCloud(initialRecord);
    } catch (e) {
      console.warn('[UPLOAD META WARN]', e?.message || String(e));
    }

    const fileId = metaCode ? `QV_${metaCode}_${generateSecureId(6)}` : generateSecureId(12);

    const record = {
      ...initialRecord,
      id: fileId,
    };

    const records = readDB();
    records.push(record);
    writeDB(records);

    const { storagePath: _sp, base64Data: _bd, fileRemoteUrl: _fru, ...publicRecord } = record;
    return res.status(200).json({ success: true, file: publicRecord });

  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File payload is too large. Maximum allowed size is 100MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    return res.status(500).json({ error: err?.message || 'Server error during upload processing' });
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[UPLOAD ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;