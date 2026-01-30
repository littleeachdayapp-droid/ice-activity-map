import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

// Initialize S3 client for Cloudflare R2
const getClient = () => {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
};

/**
 * Upload a photo to R2, stripping EXIF data and converting to WebP
 * @param buffer - The raw image buffer
 * @param mimeType - The original MIME type of the image
 * @returns The public URL of the uploaded photo, or null if R2 is not configured
 */
export async function uploadPhoto(buffer: Buffer, mimeType: string): Promise<string | null> {
  const client = getClient();

  if (!client || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
    console.warn('R2 storage not configured, skipping photo upload');
    return null;
  }

  // Validate that buffer is an image
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  if (!validMimeTypes.includes(mimeType.toLowerCase())) {
    throw new Error('Invalid image type. Supported types: JPEG, PNG, WebP, GIF, HEIC');
  }

  try {
    // Process image with sharp:
    // - Auto-rotate based on EXIF orientation
    // - Strip all EXIF metadata for privacy
    // - Resize if larger than 1920px
    // - Convert to WebP for smaller file size
    const processed = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    const key = `photos/${randomUUID()}.webp`;

    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: processed,
      ContentType: 'image/webp',
    }));

    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error('Error uploading photo to R2:', error);
    throw new Error('Failed to process and upload photo');
  }
}

/**
 * Delete a photo from R2
 * @param photoUrl - The full URL of the photo to delete
 */
export async function deletePhoto(photoUrl: string): Promise<void> {
  const client = getClient();

  if (!client || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
    console.warn('R2 storage not configured, skipping photo deletion');
    return;
  }

  try {
    // Extract the key from the URL
    const key = photoUrl.replace(`${process.env.R2_PUBLIC_URL}/`, '');

    await client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
  } catch (error) {
    console.error('Error deleting photo from R2:', error);
    // Don't throw - deletion failures shouldn't break the flow
  }
}

/**
 * Check if R2 storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}
