import { Readable } from 'stream';

export interface StorageFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface StorageFolderMetadata {
  id: string;
  name: string;
  parentFolderId?: string;
}

export interface StorageStreamResponse {
  stream: Readable | ReadableStream;
  contentLength: number;
  contentType: string;
  contentRange?: string;
  acceptRanges: string;
  status: number;
}

export interface StorageProvider {
  /**
   * Creates a folder in the storage backend.
   */
  createFolder(name: string, parentFolderId?: string): Promise<StorageFolderMetadata>;

  /**
   * Initiates a resumable upload session.
   * Returns a direct upload URL so the browser client can upload directly to Google Drive
   * without routing massive video payloads through the application server.
   */
  initiateResumableUpload(options: {
    filename: string;
    mimeType: string;
    size?: number;
    parentFolderId?: string;
    origin?: string;
  }): Promise<{ uploadUrl: string }>;

  /**
   * Direct server-side upload stream (for small files/thumbnails if needed).
   */
  upload(options: {
    filename: string;
    mimeType: string;
    stream: Readable;
    parentFolderId?: string;
  }): Promise<StorageFileMetadata>;

  /**
   * Retrieves metadata for a file.
   */
  getMetadata(fileId: string): Promise<StorageFileMetadata>;

  /**
   * Retrieves a readable stream for a video file with partial content (Range) support.
   */
  getStream(fileId: string, rangeHeader?: string): Promise<StorageStreamResponse>;

  /**
   * Deletes a file from the storage backend.
   */
  delete(fileId: string): Promise<boolean>;

  /**
   * Updates the filename of an existing file.
   */
  updateFileName?(fileId: string, name: string): Promise<boolean>;

  /**
   * Lists files inside a given folder.
   */
  listFiles(folderId?: string): Promise<StorageFileMetadata[]>;
}
