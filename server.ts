import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

export interface FileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  expiresAt: number | null;
  downloadLimit: number | null;
  downloadCount: number;
  requireConfirmation: boolean;
  isExpired: boolean;
  isDeleted: boolean;
  category: 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'archive' | 'text' | 'other';
  ownerToken: string;
  storagePath: string;
  base64Data?: string;
}

declare global {
  // Global declaration for in-memory persistence across serverless warm requests
  var _filesDB: FileRecord[] | undefined;
}

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

// Database helper functions with in-memory fallback for serverless execution
function readDB(): FileRecord[] {
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

function writeDB(records: FileRecord[]) {
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

// Generate secure random ID (cryptographically random)
function generateSecureId(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Detect category from mimeType or extension
function getCategory(mimeType: string, filename: string): FileRecord['category'] {
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

// Helper to check and update expiration status on file records
function checkRecordExpiration(record: FileRecord): FileRecord {
  if (!record.isExpired && record.expiresAt && Date.now() > record.expiresAt) {
    record.isExpired = true;
  }
  return record;
}

// Use memory storage for Multer to guarantee serverless reliability
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max limit
});

export const app = express();

// 1. CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Owner-Token, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 2. Express Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. File API Routes
app.post(['/api/files/upload', '/files/upload'], (req, res) => {
  console.log(`[UPLOAD REQUEST] Received POST ${req.originalUrl || req.url}`);

  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[MULTER UPLOAD ERROR]', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File payload is too large. Maximum allowed size is 100MB.',
          });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ error: err.message || 'File processing failed' });
    }

    try {
      if (!req.file) {
        console.warn('[UPLOAD FAILED] No file provided in request body');
        return res.status(400).json({ error: 'No file received in request' });
      }

      const fileId = generateSecureId(12);
      const ownerToken = generateSecureId(24);
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype || 'application/octet-stream';
      const size = req.file.size;
      const createdAt = Date.now();

      console.log(`[FILE RECEIVED] ID: ${fileId}, Name: "${originalName}", Type: "${mimeType}", Size: ${size} bytes`);

      if (size === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty (0 bytes)' });
      }

      // Base64 storage for universal multi-instance retrieval
      const base64Data = req.file.buffer.toString('base64');

      // Expiration parameter
      const expirationOpt = req.body.expiration || 'never';
      let expiresAt: number | null = null;
      if (expirationOpt === '10m') expiresAt = createdAt + 10 * 60 * 1000;
      else if (expirationOpt === '1h') expiresAt = createdAt + 60 * 60 * 1000;
      else if (expirationOpt === '24h') expiresAt = createdAt + 24 * 60 * 60 * 1000;
      else if (expirationOpt === '7d') expiresAt = createdAt + 7 * 24 * 60 * 60 * 1000;
      else if (expirationOpt === '30d') expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000;

      // Download limit
      const limitOpt = req.body.downloadLimit;
      let downloadLimit: number | null = null;
      if (limitOpt && limitOpt !== 'unlimited') {
        const parsed = parseInt(limitOpt, 10);
        if (!isNaN(parsed) && parsed > 0) downloadLimit = parsed;
      }

      const requireConfirmation =
        req.body.requireConfirmation === 'true' || req.body.requireConfirmation === true;

      const category = getCategory(mimeType, originalName);

      // Save to disk if permitted by environment
      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = path.join(UPLOADS_DIR, `${fileId}_${safeName}`);
      try {
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        fs.writeFileSync(storagePath, req.file.buffer);
      } catch (e) {
        console.warn('[STORAGE WARN] Disk write skipped, using memory buffer:', e);
      }

      const record: FileRecord = {
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
        storagePath,
        base64Data,
      };

      console.log(`[STORAGE COMPLETED] File ${fileId} stored in memory/base64 buffer`);

      const records = readDB();
      records.push(record);
      writeDB(records);

      console.log(`[DB OPERATION] File ${fileId} registered in database. Total records: ${records.length}`);

      const { storagePath: _sp, base64Data: _bd, ...publicRecord } = record;
      return res.status(200).json({ success: true, file: publicRecord });
    } catch (err: any) {
      console.error('[UPLOAD FATAL EXCEPTION]', err);
      return res.status(500).json({ error: err.message || 'Server error during upload' });
    }
  });
});

// API Route: Batch History Status Check
app.post(['/api/files/history', '/files/history'], (req, res) => {
  const { items } = req.body as { items: { id: string; ownerToken: string }[] };
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const records = readDB();
  const updatedRecords = records.map((r) => checkRecordExpiration(r));
  writeDB(updatedRecords);

  const result = items.map((item) => {
    const found = updatedRecords.find((r) => r.id === item.id);
    if (!found) {
      return { id: item.id, isNotFound: true, isDeleted: true };
    }
    const isLimitReached = found.downloadLimit !== null && found.downloadCount >= found.downloadLimit;
    const { storagePath: _sp, base64Data: _bd, ownerToken, ...publicInfo } = found;
    return {
      ...publicInfo,
      isLimitReached,
      isOwner: ownerToken === item.ownerToken,
    };
  });

  return res.json({ items: result });
});

// API Route: Get File Info
app.get(['/api/files/:id', '/files/:id'], (req, res) => {
  const { id } = req.params;
  const records = readDB();
  let record = records.find((r) => r.id === id);

  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  record = checkRecordExpiration(record);
  writeDB(records);

  const reqOwnerToken = req.headers['x-owner-token'] as string;
  const isOwner = Boolean(reqOwnerToken && reqOwnerToken === record.ownerToken);
  const isLimitReached = record.downloadLimit !== null && record.downloadCount >= record.downloadLimit;

  const { storagePath: _sp, base64Data: _bd, ownerToken: _ot, ...publicInfo } = record;

  return res.json({
    ...publicInfo,
    isLimitReached,
    isOwner,
  });
});

// API Route: Download/Raw File Stream
app.get(['/api/files/:id/raw', '/files/:id/raw'], (req, res) => {
  const { id } = req.params;
  const records = readDB();
  let record = records.find((r) => r.id === id);

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

  // Increment download count
  record.downloadCount += 1;
  writeDB(records);

  const isDownload = req.query.download === 'true';
  const dispositionType = isDownload ? 'attachment' : 'inline';

  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Length', record.size);
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(record.originalName)}"`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  // Serve from memory base64 buffer if available
  if (record.base64Data) {
    console.log(`[RAW FILE SERVED] ${id} (${record.originalName}) served from memory buffer`);
    const fileBuffer = Buffer.from(record.base64Data, 'base64');
    return res.send(fileBuffer);
  }

  // Fallback to disk if file exists
  if (fs.existsSync(record.storagePath)) {
    console.log(`[RAW FILE SERVED] ${id} (${record.originalName}) served from disk stream`);
    const stream = fs.createReadStream(record.storagePath);
    return stream.pipe(res);
  }

  return res.status(404).json({ error: 'File content unavailable' });
});

// API Route: Update File Settings (Owner only)
app.patch(['/api/files/:id', '/files/:id'], (req, res) => {
  const { id } = req.params;
  const ownerToken = req.headers['x-owner-token'] as string;

  const records = readDB();
  const record = records.find((r) => r.id === id);

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

  writeDB(records);

  const { storagePath: _sp, base64Data: _bd, ...publicInfo } = record;
  return res.json({ success: true, file: publicInfo });
});

// API Route: Delete File (Owner only)
app.delete(['/api/files/:id', '/files/:id'], (req, res) => {
  const { id } = req.params;
  const ownerToken = req.headers['x-owner-token'] as string;

  const records = readDB();
  const record = records.find((r) => r.id === id);

  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (record.ownerToken !== ownerToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  record.isDeleted = true;

  if (fs.existsSync(record.storagePath)) {
    try {
      fs.unlinkSync(record.storagePath);
    } catch (e) {
      console.error('Error deleting physical file:', e);
    }
  }

  writeDB(records);
  return res.json({ success: true, message: 'File deleted successfully' });
});

// Global API error handler guaranteeing JSON responses
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[GLOBAL EXPRESS API ERROR]', err);
  if (res.headersSent) {
    return;
  }
  return res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred',
  });
});

// Vite Middleware for Local Development & SPA Fallback for Production
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
  });
} else if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QRVault server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
