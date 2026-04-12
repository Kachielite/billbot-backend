import { v2 as cloudinary } from 'cloudinary';
import { CONSTANTS } from '@/common/configuration/constants';
import logger from '@/common/lib/logger';

cloudinary.config({
  cloud_name: CONSTANTS.CLOUDINARY_CLOUD_NAME,
  api_key: CONSTANTS.CLOUDINARY_API_KEY,
  api_secret: CONSTANTS.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a file buffer to Cloudinary.
 *
 * @param folder  Cloudinary folder (e.g. 'billbot/receipts')
 * @param path    Used as the public_id (folder/filename without extension)
 * @param buffer  Raw file buffer
 * @param mimetype  MIME type of the file (e.g. 'image/jpeg')
 * @returns       Secure public URL of the uploaded asset
 */
export async function uploadFile(
  folder: string,
  path: string,
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  const resourceType = mimetype.startsWith('image/') ? 'image' : 'raw';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: path.replace(/\//g, '_'), // flatten path into public_id
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          logger.error(`Cloudinary upload error: ${error?.message}`);
          reject(new Error(`Failed to upload file: ${error?.message}`));
          return;
        }
        resolve(result.secure_url);
      },
    );

    stream.end(buffer);
  });
}
