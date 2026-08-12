import { put } from '@vercel/blob';

export default async function handler(request: Request) {
  console.log('[BLOB] token request received');
  console.log('[BLOB] method:', request.method);
  console.log('[BLOB] BLOB_READ_WRITE_TOKEN present:', !!process.env.BLOB_READ_WRITE_TOKEN);

  try {
    const body = await request.json();
    console.log('[BLOB] body parsed successfully');
    console.log('[BLOB] body keys:', Object.keys(body));

    const { filename, contentType, size } = body;
    
    if (!filename || !contentType) {
      console.error('[BLOB] Missing required fields');
      return Response.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    console.log('[BLOB] Generating upload URL with handleUploadUrl');

    // Generate a unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const uniqueFilename = `${timestamp}-${randomId}-${filename}`;

    // Generate upload URL using put with handleUploadUrl
    const blob = await put(uniqueFilename, [], {
      access: 'public',
      contentType,
      handleUploadUrl: true,
    });

    console.log('[BLOB] Upload URL generated successfully');
    console.log('[BLOB] Upload URL:', blob.url);
    console.log('[BLOB] Filename:', uniqueFilename);

    return Response.json({
      success: true,
      uploadUrl: blob.url,
      filename: uniqueFilename,
    });
  } catch (err) {
    console.error('[BLOB] error:', err);
    console.error('[BLOB] error name:', err?.name);
    console.error('[BLOB] error message:', err?.message);
    console.error('[BLOB] error stack:', err?.stack);
    return Response.json({ error: err?.message || 'Failed to generate upload token' }, { status: 500 });
  }
}