import express from 'express';
import path from 'path';
import fs from 'fs';

const isVercel = Boolean(process.env.VERCEL);
const BASE_DIR = isVercel ? '/tmp' : process.cwd();
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'files.json');

console.log('[FILES] DB_FILE path:', DB_FILE);
console.log('[FILES] isVercel:', isVercel);
console.log('[FILES] BASE_DIR:', BASE_DIR);

// Database helpers
function readDB() {
  if (globalThis._filesDB) {
    console.log('[FILES] reading from memory cache');
    return globalThis._filesDB;
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const records = JSON.parse(data);
      globalThis._filesDB = records;
      console.log('[FILES] read from disk, records count:', records.length);
      return records;
    } else {
      console.log('[FILES] DB file does not exist:', DB_FILE);
    }
  } catch (err) {
    console.error('[DB READ ERROR]', err);
  }
  globalThis._filesDB = [];
  console.log('[FILES] initialized empty DB');
  return globalThis._filesDB;
}

function writeDB(records) {
  globalThis._filesDB = records;
  try {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('[FILES] created data directory:', dataDir);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
    console.log('[FILES] wrote to disk, records count:', records.length);
  } catch (err) {
    console.warn('[DB WRITE WARN]', err);
  }
}

async function findRecord(id) {
  const records = readDB();
  let record = records.find((r) => r.id === id);
  if (record) return record;

  return null;
}

function checkRecordExpiration(record) {
  if (!record.isExpired && record.expiresAt && Date.now() > record.expiresAt) {
    record.isExpired = true;
  }
  return record;
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

// Body parsers (safe for non-file routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// GET file info
app.get('/api/files/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[RETRIEVE] requested image ID:', id);
  let record = await findRecord(id);

  if (!record) {
    console.log('[RETRIEVE] metadata not found for ID:', id);
    return res.status(404).json({ error: 'File not found' });
  }

  console.log('[RETRIEVE] metadata found for ID:', id);
  console.log('[RETRIEVE] record:', {
    id: record.id,
    originalName: record.originalName,
    storagePath: record.storagePath,
    base64Data: !!record.base64Data,
    fileRemoteUrl: record.fileRemoteUrl,
  });

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

// GET raw file
app.get('/api/files/:id/raw', async (req, res) => {
  const { id } = req.params;
  console.log('[RETRIEVE] raw file request for ID:', id);
  let record = await findRecord(id);

  if (!record) {
    console.log('[RETRIEVE] metadata not found for raw file ID:', id);
    return res.status(404).json({ error: 'File not found' });
  }

  console.log('[RETRIEVE] metadata found for raw file');
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
    console.log('[RETRIEVE] serving from base64Data');
    const fileBuffer = Buffer.from(record.base64Data, 'base64');
    console.log('[RETRIEVE] response sent from base64Data');
    return res.send(fileBuffer);
  }

  if (record.fileRemoteUrl) {
    console.log('[RETRIEVE] serving from fileRemoteUrl:', record.fileRemoteUrl);
    try {
      const cloudRes = await fetch(record.fileRemoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x86) QRVault/1.0',
        },
      });
      if (cloudRes.ok && cloudRes.body) {
        const arrayBuffer = await cloudRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log('[RETRIEVE] response sent from fileRemoteUrl');
        return res.send(buffer);
      }
    } catch (e) {
      console.error('[RAW ERROR]', e);
    }
  }

  if (record.storagePath && fs.existsSync(record.storagePath)) {
    console.log('[RETRIEVE] serving from storagePath:', record.storagePath);
    const stream = fs.createReadStream(record.storagePath);
    console.log('[RETRIEVE] response sent from storagePath');
    return stream.pipe(res);
  }

  console.log('[RETRIEVE] no storage method available, returning 404');
  return res.status(404).json({ error: 'File content unavailable' });
});

// PATCH update file
app.patch('/api/files/:id', async (req, res) => {
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

// DELETE file
app.delete('/api/files/:id', async (req, res) => {
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
      console.error('Error deleting file:', e);
    }
  }

  const records = readDB();
  writeDB(records);
  return res.json({ success: true, message: 'File deleted successfully' });
});

// POST history
app.post('/api/files/history', async (req, res) => {
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

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[FILES ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;