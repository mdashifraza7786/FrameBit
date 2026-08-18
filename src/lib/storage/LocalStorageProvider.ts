import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { StorageProvider, StorageFileMetadata, StorageFolderMetadata, StorageStreamResponse } from './types';

const STORAGE_ROOT = path.join(process.cwd(), '.storage_local');

export class LocalStorageProvider implements StorageProvider {
  constructor() {
    if (!fs.existsSync(STORAGE_ROOT)) {
      fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
  }

  private getMetaFilePath(id: string): string {
    return path.join(STORAGE_ROOT, `${id}.meta.json`);
  }

  private getDataFilePath(id: string): string {
    return path.join(STORAGE_ROOT, `${id}.bin`);
  }

  async createFolder(name: string, parentFolderId?: string): Promise<StorageFolderMetadata> {
    const id = `folder_${crypto.randomBytes(8).toString('hex')}`;
    const meta = {
      id,
      name,
      isFolder: true,
      parentFolderId,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.getMetaFilePath(id), JSON.stringify(meta, null, 2));
    return { id, name, parentFolderId };
  }

  async initiateResumableUpload(options: {
    filename: string;
    mimeType: string;
    size?: number;
    parentFolderId?: string;
    origin?: string;
  }): Promise<{ uploadUrl: string }> {
    const id = `file_${crypto.randomBytes(12).toString('hex')}`;
    const meta = {
      id,
      name: options.filename,
      mimeType: options.mimeType,
      size: options.size || 0,
      parentFolderId: options.parentFolderId,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.getMetaFilePath(id), JSON.stringify(meta, null, 2));
    // For local fallback, direct upload URL goes to local API upload endpoint
    return { uploadUrl: `/api/upload/local?fileId=${id}` };
  }

  async upload(options: {
    filename: string;
    mimeType: string;
    stream: Readable;
    parentFolderId?: string;
  }): Promise<StorageFileMetadata> {
    const id = `file_${crypto.randomBytes(12).toString('hex')}`;
    const filePath = this.getDataFilePath(id);
    const writeStream = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      options.stream.pipe(writeStream);
      options.stream.on('error', reject);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    const stat = fs.statSync(filePath);
    const meta: StorageFileMetadata = {
      id,
      name: options.filename,
      mimeType: options.mimeType,
      size: stat.size,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.getMetaFilePath(id), JSON.stringify(meta, null, 2));
    return meta;
  }

  async getMetadata(fileId: string): Promise<StorageFileMetadata> {
    const metaPath = this.getMetaFilePath(fileId);
    if (!fs.existsSync(metaPath)) {
      throw new Error(`File not found: ${fileId}`);
    }
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return data;
  }

  async getStream(fileId: string, rangeHeader?: string): Promise<StorageStreamResponse> {
    const dataPath = this.getDataFilePath(fileId);
    const meta = await this.getMetadata(fileId);

    if (!fs.existsSync(dataPath)) {
      throw new Error(`File binary not found: ${fileId}`);
    }

    const stat = fs.statSync(dataPath);
    const totalSize = stat.size;

    if (!rangeHeader) {
      const stream = fs.createReadStream(dataPath);
      return {
        stream,
        contentLength: totalSize,
        contentType: meta.mimeType || 'video/mp4',
        acceptRanges: 'bytes',
        status: 200,
      };
    }

    // Parse Range: bytes=start-end
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(dataPath, { start, end });

    return {
      stream,
      contentLength: chunksize,
      contentType: meta.mimeType || 'video/mp4',
      contentRange: `bytes ${start}-${end}/${totalSize}`,
      acceptRanges: 'bytes',
      status: 206,
    };
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      const dataPath = this.getDataFilePath(fileId);
      const metaPath = this.getMetaFilePath(fileId);
      if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(folderId?: string): Promise<StorageFileMetadata[]> {
    const files = fs.readdirSync(STORAGE_ROOT);
    const results: StorageFileMetadata[] = [];

    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const meta = JSON.parse(fs.readFileSync(path.join(STORAGE_ROOT, file), 'utf8'));
        if (!meta.isFolder && (!folderId || meta.parentFolderId === folderId)) {
          results.push(meta);
        }
      }
    }
    return results;
  }
}
