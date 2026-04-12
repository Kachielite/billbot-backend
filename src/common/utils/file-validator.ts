/**
 * Validates uploaded image files by inspecting magic bytes (file signatures).
 * This prevents MIME-type spoofing where a client sends a crafted file
 * with a false Content-Type header.
 */

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_RIFF = Buffer.from('RIFF');
const WEBP_MARK = Buffer.from('WEBP');

function startsWith(buf: Buffer, magic: Buffer): boolean {
  if (buf.length < magic.length) return false;
  return magic.compare(buf, 0, magic.length) === 0;
}

/**
 * Returns true if the buffer's magic bytes match the claimed MIME type.
 */
export function validateImageMagicBytes(buffer: Buffer, mimetype: string): boolean {
  switch (mimetype) {
    case 'image/jpeg':
      return startsWith(buffer, JPEG_MAGIC);

    case 'image/png':
      return startsWith(buffer, PNG_MAGIC);

    case 'image/webp':
      // WebP: starts with "RIFF" at offset 0, then 4 bytes size, then "WEBP" at offset 8
      return (
        buffer.length >= 12 &&
        startsWith(buffer, WEBP_RIFF) &&
        WEBP_MARK.compare(buffer, 8, 12) === 0
      );

    default:
      return false;
  }
}
