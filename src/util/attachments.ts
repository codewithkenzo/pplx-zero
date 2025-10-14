import { readFile, stat } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { Attachment, AttachmentInput } from '../schema.js';

// Supported file types and their MIME types
// Based on official Perplexity API documentation
const IMAGE_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heif': 'image/heif',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
} as const;

const DOCUMENT_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
} as const;

// File size limits (50MB max as per Perplexity docs)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const MAX_ATTACHMENTS = 10; // Maximum files per request

/**
 * Validate if a file type is supported
 */
export function isSupportedFileType(extension: string): boolean {
  return extension.toLowerCase() in IMAGE_MIME_TYPES ||
         extension.toLowerCase() in DOCUMENT_MIME_TYPES;
}

/**
 * Determine if a file is an image based on its extension
 */
export function isImageFile(extension: string): boolean {
  return extension.toLowerCase() in IMAGE_MIME_TYPES;
}

/**
 * Get MIME type for a file extension
 */
export function getMimeType(extension: string): string | null {
  const ext = extension.toLowerCase();
  return IMAGE_MIME_TYPES[ext as keyof typeof IMAGE_MIME_TYPES] ||
         DOCUMENT_MIME_TYPES[ext as keyof typeof DOCUMENT_MIME_TYPES] ||
         null;
}

/**
 * Calculate tokens for an image based on dimensions
 * Formula: tokens = (width px × height px) / 750
 */
export function calculateImageTokens(width: number, height: number): number {
  return Math.ceil((width * height) / 750);
}

/**
 * Get image dimensions for common image formats
 */
export async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    // For now, return estimated dimensions
    // In a real implementation, you'd use an image processing library like sharp or jimp
    const buffer = await readFile(filePath);

    // Basic PNG/JPEG dimension detection (simplified)
    if (buffer.length < 24) return null;

    // This is a placeholder - in production, use a proper image library
    // For now, we'll estimate common dimensions
    return { width: 1920, height: 1080 }; // Default estimate
  } catch {
    return null;
  }
}

/**
 * Validate file size and existence
 */
export async function validateFile(filePath: string): Promise<{ valid: boolean; error?: string; size?: number }> {
  try {
    const stats = await stat(filePath);

    if (!stats.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }

    if (stats.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${Math.round(stats.size / 1024 / 1024)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        size: stats.size
      };
    }

    return { valid: true, size: stats.size };
  } catch (error) {
    return {
      valid: false,
      error: `Cannot access file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process an attachment input into a full attachment object
 */
export async function processAttachment(input: AttachmentInput): Promise<Attachment> {
  const filePath = input.path;
  const fileName = input.name || basename(filePath);
  const extension = extname(fileName);
  const mimeType = getMimeType(extension);

  if (!mimeType) {
    throw new Error(`Unsupported file type: ${extension}`);
  }

  // Validate file
  const validation = await validateFile(filePath);
  if (!validation.valid) {
    throw new Error(validation.error || 'File validation failed');
  }

  // Read file content
  const fileContent = await readFile(filePath);

  // Create appropriate URL format based on file type
  const base64Content = fileContent.toString('base64');
  let url: string;

  if (isImageFile(extension)) {
    // Images use data URL format
    url = `data:${mimeType};base64,${base64Content}`;
  } else {
    // Documents use raw base64 without prefix
    url = base64Content;
  }

  // Calculate tokens for images
  let tokens: number | undefined;
  if (isImageFile(extension)) {
    const dimensions = await getImageDimensions(filePath);
    if (dimensions) {
      tokens = calculateImageTokens(dimensions.width, dimensions.height);
    }
  }

  return {
    name: fileName,
    extension,
    mimeType,
    url,
    size: validation.size,
  };
}

/**
 * Process multiple attachment inputs
 */
export async function processAttachments(inputs: AttachmentInput[]): Promise<Attachment[]> {
  if (inputs.length > MAX_ATTACHMENTS) {
    throw new Error(`Maximum ${MAX_ATTACHMENTS} attachments allowed per request`);
  }

  const attachments: Attachment[] = [];

  for (const input of inputs) {
    try {
      const attachment = await processAttachment(input);
      attachments.push(attachment);
    } catch (error) {
      throw new Error(`Failed to process attachment ${input.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return attachments;
}

/**
 * Validate attachment inputs before processing
 */
export function validateAttachmentInputs(inputs: AttachmentInput[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (inputs.length > MAX_ATTACHMENTS) {
    errors.push(`Maximum ${MAX_ATTACHMENTS} attachments allowed per request`);
  }

  for (const input of inputs) {
    if (!input.path) {
      errors.push('Attachment path is required');
      continue;
    }

    const extension = extname(input.path).toLowerCase();
    if (!isSupportedFileType(extension)) {
      errors.push(`Unsupported file type: ${extension} for ${input.path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}