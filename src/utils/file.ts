import { promises as fs } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { homedir } from 'node:os';

/**
 * File system utilities for PPLX-Zero
 */
export class FileUtils {
  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Write file with backup
   */
  static async writeFileWithBackup(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDir(dirname(filePath));

      // Create backup if file exists
      try {
        const existingContent = await fs.readFile(filePath, 'utf-8');
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, existingContent);
      } catch {
        // File doesn't exist, no backup needed
      }

      // Write new content
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Read file safely
   */
  static async readFileSafely(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Get file info
   */
  static async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size: number;
    isFile: boolean;
    extension: string;
    basename: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        isFile: stats.isFile(),
        extension: extname(filePath),
        basename: basename(filePath),
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {
          exists: false,
          size: 0,
          isFile: false,
          extension: extname(filePath),
          basename: basename(filePath),
        };
      }
      throw error;
    }
  }

  /**
   * Create export directory
   */
  static async createExportDir(): Promise<string> {
    const exportDir = join(homedir(), '.pplx-zero', 'exports');
    await this.ensureDir(exportDir);
    return exportDir;
  }

  /**
   * Generate unique filename
   */
  static generateUniqueFilename(basePath: string, extension: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const cleanBase = basename(basePath).replace(/[^a-zA-Z0-9_-]/g, '_');

    return `${cleanBase}_${timestamp}_${randomSuffix}${extension}`;
  }

  /**
   * Clean up old backup files
   */
  static async cleanupBackups(dirPath: string, maxAge: number = 7): Promise<void> {
    try {
      const files = await fs.readdir(dirPath);
      const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.endsWith('.backup.')) {
          const filePath = join(dirPath, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup backup files:', error);
    }
  }

  /**
   * Get human readable file size
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Validate file path
   */
  static validatePath(filePath: string): boolean {
    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(filePath)) {
      return false;
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    const filename = basename(filePath);
    if (reservedNames.test(filename)) {
      return false;
    }

    return true;
  }
}