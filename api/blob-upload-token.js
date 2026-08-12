import express from 'express';
import { put } from '@vercel/blob';

const app = express();

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Body parser
app.use(express.json({ limit: '10mb' }));

// Generate Blob upload token endpoint
app.post('/api/blob-upload-token', async (req, res) => {
  try {
    const { filename, contentType, size } = req.body;
    
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Missing filename or contentType' });
    }

    // Generate a unique filename with timestamp and random ID
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const uniqueFilename = `${timestamp}-${randomId}-${filename}`;

    // Generate upload URL from Vercel Blob
    const blob = await put(uniqueFilename, [], {
      access: 'public',
      contentType,
    });

    return res.status(200).json({
      success: true,
      uploadUrl: blob.url,
      filename: uniqueFilename,
    });
  } catch (err) {
    console.error('[BLOB UPLOAD TOKEN ERROR]', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate upload token' });
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[BLOB UPLOAD TOKEN ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;