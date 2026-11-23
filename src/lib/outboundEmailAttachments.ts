import JSZip from 'jszip';

export type EmailImageDeliveryMode = 'inline' | 'zip';

export interface PreparedEmailAttachment {
  filename: string;
  content: string;
  contentType: string;
  encoding: 'base64';
  cid?: string;
}

export interface ZipImageInput {
  filename: string;
  bytes: Uint8Array;
}

export const EMAIL_SIZE_INFO_BYTES = 5 * 1024 * 1024;
export const EMAIL_SIZE_WARNING_BYTES = 8 * 1024 * 1024;
export const EMAIL_SIZE_STRONG_WARNING_BYTES = 12 * 1024 * 1024;
export const EMAIL_SIZE_MAX_BYTES = 25 * 1024 * 1024;

export const exceedsEmailSizeLimit = (
  estimatedMessageBytes: number,
  maximumMessageBytes = EMAIL_SIZE_MAX_BYTES,
) => estimatedMessageBytes > maximumMessageBytes;

export const estimateEncodedBase64Bytes = (base64: string) => {
  const encodedCharacters = base64.replace(/\s/g, '').length;
  return encodedCharacters + Math.ceil(encodedCharacters / 76) * 2;
};

export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const safeZipFilename = (filename: string) => {
  const basename = filename.split(/[\\/]/).pop()?.trim() || 'image';
  const withoutControlCharacters = Array.from(basename)
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('');
  const cleaned = withoutControlCharacters
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'image';
};

const uniqueZipFilename = (filename: string, used: Set<string>) => {
  const safeName = safeZipFilename(filename);
  const extensionIndex = safeName.lastIndexOf('.');
  const base = extensionIndex > 0 ? safeName.slice(0, extensionIndex) : safeName;
  const extension = extensionIndex > 0 ? safeName.slice(extensionIndex) : '';
  let candidate = safeName;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}${extension}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

export async function createImagesZipAttachment(
  images: ZipImageInput[],
  zipFilename: string,
): Promise<PreparedEmailAttachment> {
  if (images.length === 0) throw new Error('At least one image is required to create a ZIP attachment.');

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const image of images) {
    zip.file(uniqueZipFilename(image.filename, usedNames), image.bytes, { binary: true });
  }

  // DEFLATE is lossless relative to the already-stored image bytes. Most photo
  // formats will not shrink much, but this still produces one portable file.
  const content = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    filename: safeZipFilename(zipFilename).replace(/\.zip$/i, '') + '.zip',
    content,
    contentType: 'application/zip',
    encoding: 'base64',
  };
}
