import path from 'path';
import { AppError } from '../middleware/errorHandler.js';

export const ALLOWED_FILE_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
]);

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

export const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.phtml',
  '.js',
  '.mjs',
  '.ts',
  '.py',
  '.vbs',
  '.bin',
  '.msi',
  '.jar',
  '.html',
  '.htm',
  '.xhtml',
  '.svg',
  '.cgi',
  '.pl',
  '.asp',
  '.aspx',
  '.dll',
  '.so',
  '.com',
]);

// Maximum allowable file size for KYC & loan supporting documents: 10 MB
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Sanitizes a filename, neutralizing path traversal (../, ..\), null bytes, and shell metacharacters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed-document';

  // Strip null bytes
  let clean = filename.replace(/\0/g, '');

  // Strip path traversal sequences and separators
  clean = path.basename(clean);

  // Replace special characters except alphanumeric, hyphen, underscore, and dot
  clean = clean.replace(/[^a-zA-Z0-9.\-_]/g, '_');

  // Collapse consecutive dots to avoid hidden directory exploits
  clean = clean.replace(/\.{2,}/g, '.');

  // Limit filename length to 120 characters
  if (clean.length > 120) {
    const ext = path.extname(clean);
    clean = clean.substring(0, 120 - ext.length) + ext;
  }

  return clean || 'document';
}

/**
 * Validates file upload metadata for KYC and loan supporting files
 */
export function validateFileSecurity(params: {
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  fileUrl?: string;
}): { isValid: boolean; sanitizedFilename: string } {
  const { filename, mimeType, sizeBytes, fileUrl } = params;

  if (!filename || typeof filename !== 'string') {
    throw AppError.badRequest('File document title or name is required.');
  }

  // 1. Check for path traversal or null byte injection attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    throw AppError.badRequest('Invalid file name: directory traversal or null byte injection detected.');
  }

  const ext = path.extname(filename).toLowerCase();

  // 2. Reject explicitly blacklisted executable/script extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw AppError.badRequest(
      `File extension '${ext}' is strictly prohibited for security reasons.`
    );
  }

  // 3. Verify extension against allowed whitelist if an extension is provided
  if (ext && !ALLOWED_FILE_EXTENSIONS.has(ext)) {
    throw AppError.badRequest(
      `File extension '${ext}' is not supported. Allowed formats: PDF, PNG, JPG/JPEG, WEBP, DOC/DOCX, XLS/XLSX, CSV.`
    );
  }

  // 4. Validate MIME type if supplied
  if (mimeType) {
    const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      throw AppError.badRequest(
        `MIME type '${mimeType}' is not permitted. Only standard banking documents and image scans are accepted.`
      );
    }
  }

  // 5. Validate file size (max 10MB)
  if (sizeBytes !== undefined && sizeBytes !== null) {
    if (sizeBytes <= 0) {
      throw AppError.badRequest('File size must be greater than zero bytes.');
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw AppError.badRequest(
        `File size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowable limit of 10 MB.`
      );
    }
  }

  // 6. Inspect data URLs for payload size or dangerous mime types
  if (fileUrl && fileUrl.startsWith('data:')) {
    const commaIndex = fileUrl.indexOf(',');
    if (commaIndex > 0) {
      const header = fileUrl.substring(5, commaIndex);
      const mime = header.split(';')[0];
      if (mime && !ALLOWED_MIME_TYPES.has(mime.toLowerCase())) {
        throw AppError.badRequest(`Embedded file data contains unauthorized MIME type: ${mime}`);
      }

      // Check estimated binary length from base64 string
      const base64Data = fileUrl.substring(commaIndex + 1);
      const estimatedSizeBytes = Math.round((base64Data.length * 3) / 4);
      if (estimatedSizeBytes > MAX_FILE_SIZE_BYTES) {
        throw AppError.badRequest(
          `Embedded payload (${(estimatedSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 10 MB.`
        );
      }
    }
  }

  return {
    isValid: true,
    sanitizedFilename: sanitizeFilename(filename),
  };
}
