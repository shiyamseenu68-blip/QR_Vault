import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { list, put } from '@vercel/blob';

const DB_BLOB_NAME = 'files-database.json';

// Database helpers using Vercel Blob for persistence
async function readDB() {
  if (globalThis._filesDB) {
    console.log('[UPLOAD] reading from memory cache');
    return globalThis._filesDB;
  }
  try {
    console.log('[UPLOAD] attempting to read from Vercel Blob');
    const blobs = await list({ prefix: DB_BLOB_NAME });
    if (blobs.blobs.length > 0) {
      const blob = blobs.blobs[0];
      const response = await fetch(blob.url);
      const data = await response.text();
      const records = JSON.parse(data);
      globalThis._filesDB = records;
      console.log('[UPLOAD] read from Vercel Blob, records count:', records.length);
      return records;
    } else {
      console.log('[UPLOAD] no database blob found in Vercel Blob');
    }
  } catch (err) {
    console.error('[UPLOAD DB READ ERROR]', err);
  }
  globalThis._filesDB = [];
  console.log('[UPLOAD] initialized empty DB');
  return globalThis._filesDB;
}

async function writeDB(records) {
  globalThis._filesDB = records;
  try {
    const data = JSON.stringify(records, null, 2);
    const blob = await put(DB_BLOB_NAME, data, {
      access: 'public',
      contentType: 'application/json',
    });
    console.log('[UPLOAD] wrote to Vercel Blob, records count:', records.length);
  } catch (err) {
    console.error('[UPLOAD DB WRITE ERROR]', err);
    throw err;
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

    const fileId = `QV_${generateSecureId(8)}_${generateSecureId(6)}`;
    console.log('[UPLOAD] image ID:', fileId);
    console.log('[UPLOAD] image storage location: base64Data');
    console.log('[UPLOAD] base64Data present:', !!base64Data);
    console.log('[UPLOAD] file size:', size);

    const record = {
      id: fileId,
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
      storagePath: '',
      base64Data,
    };

    const records = await readDB();
    records.push(record);
    await writeDB(records);

    console.log('[UPLOAD] record saved to database for ID:', fileId);

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