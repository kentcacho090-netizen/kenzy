import { handleUpload } from '@vercel/blob/client';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Large uploads are not configured yet. Create a Vercel Blob store and connect its BLOB_READ_WRITE_TOKEN.' });
  }

  try {
    const body = req.body || {};
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
        validUntil: Date.now() + 10 * 60 * 1000,
      }),
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(response);
  } catch (error) {
    console.error('Blob upload error:', error);
    return res.status(400).json({ error: error?.message || 'Could not prepare the file upload.' });
  }
}
