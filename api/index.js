const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Readable } = require('stream');

const PORT = 3000;
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
  console.warn('[INIT WARN] Directory creation issue (handled via memory fallback):', e);
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

async function fetchMetaFromCloud(metaCode) {
  try {
    const cleanCode = metaCode.endsWith('.json') ? metaCode : `${metaCode}.json`;
    const metaUrl = `https://litter.catbox.moe/${cleanCode}`;
    const res = await fetch(metaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x86) QRVault/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const record = await res.json();
      if (record && record.originalName) {
        return record;
      }
    }
  } catch (e) {
    console.warn('[CLOUD META FETCH WARN]', e);
  }
  return null;
}

// Database helper functions
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
    console.warn('[DB WRITE WARN] Ephemeral environment file write bypassed:', err);
  }
}

async function findRecord(id) {
  const records = readDB();
  let record = records.find((r) => r.id === id);
  if (record) return record;

  // Multi-instance cloud resolver for Vercel serverless instances
  if (id.startsWith('QV_')) {
    const parts = id.split('_');
    if (parts.length >= 2) {
      const metaCode = parts[1];
      console.log(`[CLOUD RESOLVER] Attempting to fetch metadata for code: ${metaCode}`);
      const cloudRecord = await fetchMetaFromCloud(metaCode);
      if (cloudRecord) {
        cloudRecord.id = id;
        records.push(cloudRecord);
        writeDB(records);
        console.log(`[CLOUD RESOLVER SUCCESS] Resolved file ${id} (${cloudRecord.originalName}) across serverless instances`);
        return cloudRecord;
      }
    }
  }

  return null;
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

function checkRecordExpiration(record) {
  if (!record.isExpired && record.expiresAt && Date.now() > record.expiresAt) {
    record.isExpired = true;
  }
  return record;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Simplified multer handler for Vercel
function runMulterSingle(req, res, fieldName) {
  return new Promise((resolve, reject) => {
    if (req.file) {
      return resolve();
    }

    upload.single(fieldName)(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

const app = express();

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Owner-Token, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// File Upload Route
app.post(['/api/files/upload', '/files/upload', '/upload', '/api/upload'], async (req, res) => {
  const reqUrl = req.originalUrl || req.url;
  const contentType = req.headers['content-type'] || 'unknown';
  const contentLength = req.headers['content-length'] || 'unknown';

  console.log(`[API] request received - Path: ${reqUrl}, Type: ${contentType}, Length: ${contentLength}`);

  try {
    await runMulterSingle(req, res, 'file');

    if (!req.file) {
      console.warn('[UPLOAD FAILED] No file received in request body');
      return res.status(400).json({ error: 'No file received in request' });
    }

    const originalName = req.file.originalname || 'unnamed_file';
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const size = req.file.size || 0;

    console.log(`[MULTER] file received - Name: "${originalName}", Type: "${mimeType}", Size: ${size} bytes`);

    if (size === 0) {
      console.warn('[UPLOAD FAILED] Empty file (0 bytes)');
      return res.status(400).json({ error: 'Uploaded file is empty (0 bytes)' });
    }

    const ownerToken = generateSecureId(24);
    const createdAt = Date.now();
    const category = getCategory(mimeType, originalName);

    console.log(`[UPLOAD] file metadata validated - Category: ${category}`);
    console.log('[UPLOAD] storage started');

    const base64Data = size < 3 * 1024 * 1024 ? req.file.buffer.toString('base64') : undefined;

    let fileRemoteUrl = undefined;
    try {
      fileRemoteUrl = (await uploadFileToCloud(req.file.buffer, originalName, mimeType)) || undefined;
    } catch (e) {
      console.warn('[UPLOAD STORAGE WARN] Cloud payload storage skipped:', e?.message || String(e));
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
      console.warn('[UPLOAD STORAGE WARN] Ephemeral disk write skipped:', e?.message || String(e));
    }

    console.log('[UPLOAD] storage completed');

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
      console.warn('[UPLOAD META WARN] Meta cloud sync skipped:', e?.message || String(e));
    }

    const fileId = metaCode ? `QV_${metaCode}_${generateSecureId(6)}` : generateSecureId(12);

    const record = {
      ...initialRecord,
      id: fileId,
    };

    const records = readDB();
    records.push(record);
    writeDB(records);

    console.log(`[UPLOAD] metadata created - File ID: ${fileId}, MetaCode: ${metaCode || 'local'}`);
    console.log(`[UPLOAD] QR URL created - Target Code: /f/${fileId}`);

    const { storagePath: _sp, base64Data: _bd, fileRemoteUrl: _fru, ...publicRecord } = record;
    console.log('[API] response sent');
    return res.status(200).json({ success: true, file: publicRecord });

  } catch (err) {
    console.error('[UPLOAD ERROR]');
    console.error('Error Name:', err?.name || 'Error');
    console.error('Error Message:', err?.message || String(err));
    console.error('Error Stack:', err?.stack || 'No stack trace available');

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File payload is too large. Maximum allowed size is 100MB.',
        });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    return res.status(500).json({ error: err?.message || 'Server error during upload processing' });
  }
});

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Route: Batch History Status Check
app.post(['/api/files/history', '/files/history', '/history', '/api/history'], async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const result = await Promise.all(
    items.map(async (item) => {
      let found = await findRecord(item.id);
      if (!found) {
        return { id: item.id, isNotFound: true, isDeleted: true };
      }
      found = checkRecordExpiration(found);
      const isLimitReached = found.downloadLimit !== null && found.downloadCount >= found.downloadLimit;
      const { storagePath: _sp, base64Data: _bd, fileRemoteUrl: _fru, ownerToken, ...publicInfo } = found;
      return {
        ...publicInfo,
        isLimitReached,
        isOwner: ownerToken === item.ownerToken,
      };
    })
  );

  return res.json({ items: result });
});

// API Route: Download/Raw File Stream
app.get(['/api/files/:id/raw', '/files/:id/raw', '/:id/raw', '/api/:id/raw'], async (req, res) => {
  const { id } = req.params;
  let record = await findRecord(id);

  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  record = checkRecordExpiration(record);

  if (record.isDeleted) {
    return res.status(410).json({ error: 'FILE NO LONGER AVAILABLE' });
  }

  if (record.isExpired) {
    return res.status(410).json({ error: 'THIS FILE HAS EXPIRED' });
  }

  if (record.downloadLimit !== null && record.downloadCount >= record.downloadLimit) {
    return res.status(403).json({ error: 'DOWNLOAD LIMIT REACHED' });
  }

  record.downloadCount += 1;
  const records = readDB();
  writeDB(records);

  const isDownload = req.query.download === 'true';
  const dispositionType = isDownload ? 'attachment' : 'inline';

  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Length', record.size);
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(record.originalName)}"`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  if (record.base64Data) {
    console.log(`[RAW FILE SERVED] ${id} (${record.originalName}) served from base64 buffer`);
    const fileBuffer = Buffer.from(record.base64Data, 'base64');
    return res.send(fileBuffer);
  }

  if (record.fileRemoteUrl) {
    console.log(`[RAW FILE SERVED] ${id} (${record.originalName}) streaming from cloud storage: ${record.fileRemoteUrl}`);
    try {
      const cloudRes = await fetch(record.fileRemoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x86) QRVault/1.0',
        },
      });
      if (cloudRes.ok && cloudRes.body) {
        const arrayBuffer = await cloudRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
      }
    } catch (e) {
      console.error('[RAW FILE STREAM ERROR]', e);
    }
  }

  if (record.storagePath && fs.existsSync(record.storagePath)) {
    console.log(`[RAW FILE SERVED] ${id} (${record.originalName}) served from disk stream`);
    const stream = fs.createReadStream(record.storagePath);
    return stream.pipe(res);
  }

  return res.status(404).json({ error: 'File content unavailable' });
});

// API Route: Get File Info
app.get(['/api/files/:id', '/files/:id', '/:id', '/api/:id'], async (req, res) => {
  const { id } = req.params;
  let record = await findRecord(id);

  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  record = checkRecordExpiration(record);

  const reqOwnerToken = req.headers['x-owner-token'];
  const isOwner = Boolean(reqOwnerToken && reqOwnerToken === record.ownerToken);
  const isLimitReached = record.downloadLimit !== null && record.downloadCount >= record.downloadLimit;

  const { storagePath: _sp, base64Data: _bd, fileRemoteUrl: _fru, ownerToken: _ot, ...publicInfo } = record;

  return res.json({
    ...publicInfo,
    isLimitReached,
    isOwner,
  });
});

// API Route: Update File Settings
app.patch(['/api/files/:id', '/files/:id', '/:id', '/api/:id'], async (req, res) => {
  const { id } = req.params;
  const ownerToken = req.headers['x-owner-token'];

  const record = await findRecord(id);

  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (record.ownerToken !== ownerToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { expiration, downloadLimit, requireConfirmation } = req.body;

  if (expiration !== undefined) {
    if (expiration === 'never') record.expiresAt = null;
    else if (expiration === '10m') record.expiresAt = record.createdAt + 10 * 60 * 1000;
    else if (expiration === '1h') record.expiresAt = record.createdAt + 60 * 60 * 1000;
    else if (expiration === '24h') record.expiresAt = record.createdAt + 24 * 60 * 60 * 1000;
    else if (expiration === '7d') record.expiresAt = record.createdAt + 7 * 24 * 60 * 60 * 1000;
    else if (expiration === '30d') record.expiresAt = record.createdAt + 30 * 24 * 60 * 60 * 1000;
    record.isExpired = record.expiresAt ? Date.now() > record.expiresAt : false;
  }

  if (downloadLimit !== undefined) {
    if (downloadLimit === 'unlimited' || downloadLimit === null) {
      record.downloadLimit = null;
    } else {
      const parsed = parseInt(downloadLimit, 10);
      record.downloadLimit = !isNaN(parsed) && parsed > 0 ? parsed : null;
    }
  }

  if (requireConfirmation !== undefined) {
    record.requireConfirmation = Boolean(requireConfirmation);
  }

  const records = readDB();
  writeDB(records);

  const { storagePath: _sp, base64Data: _bd, fileRemoteUrl: _fru, ...publicInfo } = record;
  return res.json({ success: true, file: publicInfo });
});

// API Route: Delete File
app.delete(['/api/files/:id', '/files/:id', '/:id', '/api/:id'], async (req, res) => {
  const { id } = req.params;
  const ownerToken = req.headers['x-owner-token'];

  const record = await findRecord(id);

  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (record.ownerToken !== ownerToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  record.isDeleted = true;

  if (record.storagePath && fs.existsSync(record.storagePath)) {
    try {
      fs.unlinkSync(record.storagePath);
    } catch (e) {
      console.error('Error deleting physical file:', e);
    }
  }

  const records = readDB();
  writeDB(records);
  return res.json({ success: true, message: 'File deleted successfully' });
});

// Explicit API 404 fallback
app.all(['/api/*', '/files/*'], (_req, res) => {
  return res.status(404).json({ error: 'API route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[GLOBAL EXPRESS API ERROR]', err);
  if (res.headersSent) {
    return;
  }
  return res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred',
  });
});

// Vercel serverless function handler
const handler = (req, res) => {
  console.log('[VERCEL FUNCTION] Request received:', req.method, req.url);
  app(req, res);
};

module.exports = handler;