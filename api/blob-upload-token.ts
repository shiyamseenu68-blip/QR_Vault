import { handleUpload } from '@vercel/blob/client';

export default async function handler(request: Request) {
  console.log('[BLOB TOKEN] request received');
  console.log('[BLOB TOKEN] method:', request.method);
  console.log('[BLOB TOKEN] BLOB_READ_WRITE_TOKEN present:', !!process.env.BLOB_READ_WRITE_TOKEN);

  try {
    const body = await request.json();
    console.log('[BLOB TOKEN] body parsed successfully');

    console.log('[BLOB TOKEN] calling handleUpload');

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
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
        console.log('[BLOB TOKEN] Upload completed:', blob.url);
      }
    });

    console.log('[BLOB TOKEN] handleUpload completed');

    return Response.json(jsonResponse);
  } catch (err) {
    console.error('[BLOB TOKEN] error:', err);
    console.error('[BLOB TOKEN] error stack:', err?.stack);
    return Response.json({ error: err?.message || 'Failed to generate upload token' }, { status: 500 });
  }
}