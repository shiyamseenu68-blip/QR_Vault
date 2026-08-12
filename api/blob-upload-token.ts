import { handleUpload } from '@vercel/blob/client';

export default async function handler(request: Request) {
  console.log('[BLOB] token request received');
  console.log('[BLOB] method:', request.method);
  console.log('[BLOB] BLOB_READ_WRITE_TOKEN present:', !!process.env.BLOB_READ_WRITE_TOKEN);
  console.log('[BLOB] credentials available', !!process.env.BLOB_READ_WRITE_TOKEN);

  try {
    const body = await request.json();
    console.log('[BLOB] body parsed successfully');
    console.log('[BLOB] body keys:', Object.keys(body));

    console.log('[BLOB] handleUpload started');

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[BLOB] onBeforeGenerateToken called for:', pathname);
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
            'application/octet-stream'
          ],
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[BLOB] Upload completed:', blob.url);
        console.log('[BLOB] Upload filename:', blob.pathname);
      }
    });

    console.log('[BLOB] client token generated');
    console.log('[BLOB] handleUpload response returned');
    console.log('[BLOB] response keys:', Object.keys(jsonResponse));

    return Response.json(jsonResponse);
  } catch (err) {
    console.error('[BLOB] error:', err);
    console.error('[BLOB] error stack:', err?.stack);
    console.error('[BLOB] error name:', err?.name);
    console.error('[BLOB] error message:', err?.message);
    return Response.json({ error: err?.message || 'Failed to generate upload token' }, { status: 500 });
  }
}