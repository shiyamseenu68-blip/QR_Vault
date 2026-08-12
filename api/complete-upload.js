import express from 'express';
import crypto from 'crypto';
import { list, put } from '@vercel/blob';

const DB_BLOB_NAME = 'files-database.json';

// Database helpers using Vercel Blob for persistence
async function readDB() {
  if (globalThis._filesDB) {
    console.log('[COMPLETE] reading from memory cache');
    return globalThis._filesDB;
  }
  try {
    console.log('[COMPLETE] attempting to read from Vercel Blob');
    const blobs = await list({ prefix: DB_BLOB_NAME });
    if (blobs.blobs.length > 0) {
      const blob = blobs.blobs[0];
      const response = await fetch(blob.url);
      const data = await response.text();
      const records = JSON.parse(data);
      globalThis._filesDB = records;
      console.log('[COMPLETE] read from Vercel Blob, records count:', records.length);
      return records;
    } else {
      console.log('[COMPLETE] no database blob found in Vercel Blob');
    }
  } catch (err) {
    console.error('[COMPLETE DB READ ERROR]', err);
  }
  globalThis._filesDB = [];
  console.log('[COMPLETE] initialized empty DB');
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
    console.log('[COMPLETE] wrote to Vercel Blob, records count:', records.length);
  } catch (err) {
    console.error('[COMPLETE DB WRITE ERROR]', err);
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

    const fileId = `QV_${generateSecureId(8)}_${generateSecureId(6)}`;
    console.log('[UPLOAD] image ID (blob upload):', fileId);
    console.log('[UPLOAD] image storage location (Blob URL):', cloudUrl);

    const record = {
      ...initialRecord,
      id: fileId,
    };

    const records = await readDB();
    records.push(record);
    await writeDB(records);

    console.log('[UPLOAD] record saved to database');

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