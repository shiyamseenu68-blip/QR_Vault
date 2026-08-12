import express from 'express';
import { handleUpload } from '@vercel/blob/client';

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

// Handle Vercel Blob client upload token generation
app.post('/api/blob-upload-token', async (req, res) => {
  console.log('[BLOB TOKEN] request received');
  console.log('[BLOB TOKEN] method:', req.method);
  console.log('[BLOB TOKEN] body parsed:', JSON.stringify(req.body, null, 2));
  console.log('[BLOB TOKEN] BLOB_READ_WRITE_TOKEN present:', !!process.env.BLOB_READ_WRITE_TOKEN);

  try {
    const body = req.body;
    
    if (!body) {
      console.error('[BLOB TOKEN] error: No request body');
      return res.status(400).json({ error: 'No request body' });
    }

    console.log('[BLOB TOKEN] calling handleUpload');

    // Use handleUpload to generate client upload token
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: (pathname) => {
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'video/mp4',
            'video/quicktime',
            'video/webm',
            'audio/mpeg',
            'audio/wav',
            'audio/mp4',
            'audio/x-m4a',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/zip',
            'application/x-zip-compressed',
            'multipart/x-zip',
            'application/octet-stream',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
        };
      },
      onUploadCompleted: async ({ blob, formData }) => {
        console.log('[BLOB TOKEN] Upload completed:', blob.url);
      },
    });

    console.log('[BLOB TOKEN] handleUpload completed');

    return jsonResponse;
  } catch (err) {
    console.error('[BLOB TOKEN] error:', err);
    console.error('[BLOB TOKEN] error stack:', err?.stack);
    return res.status(500).json({ error: err?.message || 'Failed to generate upload token' });
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[BLOB TOKEN ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;