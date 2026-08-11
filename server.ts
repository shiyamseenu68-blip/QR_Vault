import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

interface FileRecord {
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
}

const PORT = 3000;
const isVercel = Boolean(process.env.VERCEL);
const BASE_DIR = isVercel ? '/tmp' : process.cwd();
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'files.json');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf-8');
}

// Database helper functions
function readDB(): FileRecord[] {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return [];
  }
}

function writeDB(records: FileRecord[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
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
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || mimeType.includes('zip') || mimeType.includes('compressed')) {
    return 'archive';
  }
  if (mimeType.startsWith('text/') || ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'csv', 'xml', 'py', 'java', 'c', 'cpp'].includes(ext)) {
    return 'text';
  }
  return 'other';
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueId = generateSecureId(16);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueId}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max file size
});

export const app = express();

async function startServer() {
  app.use(express.json());

  // Check and update expiration status on file records
  function checkRecordExpiration(record: FileRecord): FileRecord {
    if (!record.isExpired && record.expiresAt && Date.now() > record.expiresAt) {
      record.isExpired = true;
    }
    return record;
  }

  // API Route: Upload File
  app.post('/api/files/upload', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileId = generateSecureId(12);
      const ownerToken = generateSecureId(24);
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype || 'application/octet-stream';
      const size = req.file.size;
      const createdAt = Date.now();

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

      // Require confirmation
      const requireConfirmation = req.body.requireConfirmation === 'true' || req.body.requireConfirmation === true;

      const category = getCategory(mimeType, originalName);

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
        storagePath: req.file.path,
      };

      const records = readDB();
      records.push(record);
      writeDB(records);

      const { storagePath, ...publicRecord } = record;
      return res.json({ success: true, file: publicRecord });
    } catch (err: any) {
      console.error('Upload handler error:', err);
      return res.status(500).json({ error: err.message || 'Server error during upload' });
    }
  });

  // API Route: Get File Info
  app.get('/api/files/:id', (req, res) => {
    const { id } = req.params;
    const records = readDB();
    let record = records.find((r) => r.id === id);

    if (!record) {
      return res.status(404).json({ error: 'File not found' });
    }

    record = checkRecordExpiration(record);
    writeDB(records); // save updated expiration state if changed

    const reqOwnerToken = req.headers['x-owner-token'] as string;
    const isOwner = reqOwnerToken && reqOwnerToken === record.ownerToken;

    const isLimitReached = record.downloadLimit !== null && record.downloadCount >= record.downloadLimit;

    const { storagePath, ownerToken, ...publicInfo } = record;

    return res.json({
      ...publicInfo,
      isLimitReached,
      isOwner: Boolean(isOwner),
    });
  });

  // API Route: Download/Raw File Stream
  app.get('/api/files/:id/raw', (req, res) => {
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

    if (!fs.existsSync(record.storagePath)) {
      return res.status(404).json({ error: 'File on disk missing' });
    }

    // Increment download count
    record.downloadCount += 1;
    writeDB(records);

    const isDownload = req.query.download === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Length', record.size);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(record.originalName)}"`);

    const stream = fs.createReadStream(record.storagePath);
    stream.pipe(res);
  });

  // API Route: Update File Settings (Owner only)
  app.patch('/api/files/:id', (req, res) => {
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

    const { storagePath, ...publicInfo } = record;
    return res.json({ success: true, file: publicInfo });
  });

  // API Route: Delete File (Owner only)
  app.delete('/api/files/:id', (req, res) => {
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

    // Remove physical file
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

  // API Route: Batch History Status Check
  app.post('/api/files/history', (req, res) => {
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
      const isLimitReached = found.downloadLimit !== null && found.downloadCount >= found.downloadLimit;      const { storagePath, ownerToken, ...publicInfo } = found;
      return {
        ...publicInfo,
        isLimitReached,
        isOwner: ownerToken === item.ownerToken,
      };
    });

    return res.json({ items: result });
  });

  // Vite Integration & SPA fallback
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`QRVault server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
