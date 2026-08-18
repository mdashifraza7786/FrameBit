import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { StorageProvider, StorageFileMetadata, StorageFolderMetadata, StorageStreamResponse } from './types';

export class GoogleDriveStorageProvider implements StorageProvider {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private drive: drive_v3.Drive;

  constructor(tokens: { accessToken?: string; refreshToken?: string; expiryDate?: number }) {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Get fresh access token (auto-refreshed by oauth2Client if expired)
   */
  public async getAccessToken(): Promise<string | null> {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      return token || null;
    } catch (err) {
      console.error('Error refreshing Google access token:', err);
      return null;
    }
  }

  async findOrCreateFolder(name: string, parentFolderId?: string): Promise<StorageFolderMetadata> {
    let q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      q += ` and '${parentFolderId}' in parents`;
    }

    try {
      const listRes = await this.drive.files.list({
        q,
        fields: 'files(id, name, parents)',
        pageSize: 1,
      });

      if (listRes.data.files && listRes.data.files.length > 0) {
        const existing = listRes.data.files[0];
        return {
          id: existing.id || '',
          name: existing.name || name,
          parentFolderId: existing.parents?.[0],
        };
      }
    } catch (err) {
      console.warn(`Could not search for existing Google Drive folder "${name}":`, err);
    }

    return this.createFolder(name, parentFolderId);
  }

  async createFolder(name: string, parentFolderId?: string): Promise<StorageFolderMetadata> {
    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    };

    const res = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, parents',
    });

    if (!res.data.id || !res.data.name) {
      throw new Error('Failed to create folder in Google Drive');
    }

    return {
      id: res.data.id,
      name: res.data.name,
      parentFolderId: res.data.parents?.[0],
    };
  }

  async initiateResumableUpload(options: {
    filename: string;
    mimeType: string;
    size?: number;
    parentFolderId?: string;
    origin?: string;
  }): Promise<{ uploadUrl: string }> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Could not obtain valid Google OAuth access token');
    }

    const metadata: { name: string; parents?: string[] } = {
      name: options.filename,
    };
    if (options.parentFolderId) {
      metadata.parents = [options.parentFolderId];
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': options.mimeType || 'video/mp4',
    };

    if (options.origin) {
      headers['Origin'] = options.origin;
    }

    if (options.size) {
      headers['X-Upload-Content-Length'] = options.size.toString();
    }

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,thumbnailLink',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(metadata),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to initiate resumable upload session with Google Drive: ${errorText}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google Drive API did not return a resumable session Location header');
    }

    return { uploadUrl };
  }

  async upload(options: {
    filename: string;
    mimeType: string;
    stream: Readable;
    parentFolderId?: string;
  }): Promise<StorageFileMetadata> {
    const media = {
      mimeType: options.mimeType,
      body: options.stream,
    };

    const res = await this.drive.files.create({
      requestBody: {
        name: options.filename,
        parents: options.parentFolderId ? [options.parentFolderId] : undefined,
      },
      media,
      fields: 'id, name, mimeType, size, thumbnailLink, createdTime, modifiedTime',
    });

    const file = res.data;
    return {
      id: file.id || '',
      name: file.name || options.filename,
      mimeType: file.mimeType || options.mimeType,
      size: Number(file.size || 0),
      thumbnailUrl: file.thumbnailLink || undefined,
      createdAt: file.createdTime || undefined,
      modifiedAt: file.modifiedTime || undefined,
    };
  }

  async getMetadata(fileId: string): Promise<StorageFileMetadata> {
    const res = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, thumbnailLink, createdTime, modifiedTime',
    });

    const file = res.data;
    return {
      id: file.id || '',
      name: file.name || '',
      mimeType: file.mimeType || 'video/mp4',
      size: Number(file.size || 0),
      thumbnailUrl: file.thumbnailLink || undefined,
      createdAt: file.createdTime || undefined,
      modifiedAt: file.modifiedTime || undefined,
    };
  }

  async getStream(fileId: string, rangeHeader?: string): Promise<StorageStreamResponse> {
    const tokenRes = await this.oauth2Client.getAccessToken();
    const accessToken = tokenRes.token;

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const res = await fetch(driveUrl, {
      method: 'GET',
      headers: requestHeaders,
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(`Google Drive stream request failed with status: ${res.status}`);
    }

    const contentLength = Number(res.headers.get('content-length') || 0);
    const contentType = res.headers.get('content-type') || 'video/mp4';
    const contentRange = res.headers.get('content-range') || undefined;
    const status = res.status;

    return {
      stream: res.body as any,
      contentLength,
      contentType,
      contentRange,
      acceptRanges: 'bytes',
      status,
    };
  }

  async updateFileName(fileId: string, name: string): Promise<boolean> {
    try {
      await this.drive.files.update({
        fileId,
        requestBody: { name },
      });
      return true;
    } catch (err) {
      console.warn(`Failed to update Google Drive file name for ${fileId}:`, err);
      return false;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (err) {
      console.error(`Failed to delete Google Drive file ${fileId}:`, err);
      return false;
    }
  }

  async listFiles(folderId?: string): Promise<StorageFileMetadata[]> {
    let q = 'trashed = false';
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    const res = await this.drive.files.list({
      q,
      fields: 'files(id, name, mimeType, size, thumbnailLink, createdTime, modifiedTime)',
      pageSize: 100,
    });

    return (res.data.files || []).map((file) => ({
      id: file.id || '',
      name: file.name || '',
      mimeType: file.mimeType || '',
      size: Number(file.size || 0),
      thumbnailUrl: file.thumbnailLink || undefined,
      createdAt: file.createdTime || undefined,
      modifiedAt: file.modifiedTime || undefined,
    }));
  }
}
