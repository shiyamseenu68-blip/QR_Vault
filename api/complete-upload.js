import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const isVercel = Boolean(process.env.VERCEL);
const BASE_DIR = isVercel ? '/tmp' : process.cwd();
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'files.json');

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

// Body parsers (safe for this endpoint)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Complete upload endpoint
app.post('/api/files/complete-upload', async (req, res) => {
  try {
    const { filename, originalName, mimeType, size, expiration, downloadLimit, requireConfirmation, cloudUrl } = req.body;
    
    if (!originalName || !mimeType || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ownerToken = generateSecureId(24);
    const createdAt = Date.now();
    const category = getCategory(mimeType, originalName);

    const expirationOpt = expiration || 'never';
    let expiresAt = null;
    if (expirationOpt === '10m') expiresAt = createdAt + 10 * 60 * 1000;
    else if (expirationOpt === '1h') expiresAt = createdAt + 60 * 60 * 1000;
    else if (expirationOpt === '24h') expiresAt = createdAt + 24 * 60 * 60 * 1000;
    else if (expirationOpt === '7d') expiresAt = createdAt + 7 * 24 * 60 * 60 * 1000;
    else if (expirationOpt === '30d') expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000;

    const limitOpt = downloadLimit;
    let downloadLimitValue = null;
    if (limitOpt && limitOpt !== 'unlimited') {
      const parsed = parseInt(limitOpt, 10);
      if (!isNaN(parsed) && parsed > 0) downloadLimitValue = parsed;
    }

    const requireConfirmationValue = requireConfirmation === 'true' || requireConfirmation === true;

    const initialRecord = {
      id: `TEMP_${generateSecureId(8)}`,
      originalName,
      mimeType,
      size: parseInt(size, 10),
      createdAt,
      expiresAt,
      downloadLimit: downloadLimitValue,
      downloadCount: 0,
      requireConfirmation: requireConfirmationValue,
      isExpired: false,
      isDeleted: false,
      category,
      ownerToken,
      storagePath: '',
      base64Data: undefined,
      fileRemoteUrl: cloudUrl,
    };

    const fileId = generateSecureId(12);

    const record = {
      ...initialRecord,
      id: fileId,
    };

    const records = readDB();
    records.push(record);
    writeDB(records);

    const { storagePath: _sp, base64Data: _bd, fileRemoteUrl: _fru, ownerToken: _ot, ...publicRecord } = record;
    return res.status(200).json({ success: true, file: publicRecord });

  } catch (err) {
    console.error('[COMPLETE UPLOAD ERROR]', err);
    return res.status(500).json({ error: err?.message || 'Server error during upload completion' });
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[COMPLETE-UPLOAD ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;