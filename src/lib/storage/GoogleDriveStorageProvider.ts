import { google, drive_v3 } from 'googleapis';
import { Credentials } from 'google-auth-library';
import { Readable } from 'stream';
import { StorageProvider, StorageFileMetadata, StorageFolderMetadata, StorageStreamResponse } from './types';
import { connectDB } from '../db';
import { encrypt } from '../crypto';
import { User } from '../models';

export class GoogleDriveStorageProvider implements StorageProvider {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private drive: drive_v3.Drive;
  private userId?: string;

  constructor(tokens: { accessToken?: string; refreshToken?: string; expiryDate?: number }, userId?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    this.userId = userId;
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
    });

    // Persist auto-refreshed access tokens so subsequent requests reuse them
    // instead of round-tripping to Google's token endpoint every time.
    this.oauth2Client.on('tokens', (newTokens) => {
      this.persistRefreshedTokens(newTokens).catch((err) => {
        console.error('Failed to persist refreshed Google Drive tokens:', err);
      });
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  private async persistRefreshedTokens(tokens: Credentials): Promise<void> {
    if (!this.userId) return;

    const update: Record<string, string | number> = {};
    if (tokens.access_token) update['googleTokens.accessToken'] = encrypt(tokens.access_token);
    if (tokens.expiry_date) update['googleTokens.expiryDate'] = tokens.expiry_date;
    if (tokens.refresh_token) update['googleTokens.refreshToken'] = encrypt(tokens.refresh_token);

    if (Object.keys(update).length === 0) return;

    await connectDB();
    await User.findByIdAndUpdate(this.userId, { $set: update });
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
    let accessToken = await this.getAccessToken();

    const fetchStream = async (token: string | null) => {
      const requestHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (rangeHeader) {
        requestHeaders['Range'] = rangeHeader;
      }

      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      return fetch(driveUrl, {
        method: 'GET',
        headers: requestHeaders,
      });
    };

    let res = await fetchStream(accessToken);

    // If token expired (401), force refresh token and retry once
    if (res.status === 401) {
      console.warn('[GoogleDriveStorageProvider] Access token expired during stream, refreshing...');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token || null;
      if (accessToken) {
        await this.persistRefreshedTokens(credentials);
        res = await fetchStream(accessToken);
      }
    }

    if (!res.ok && res.status !== 206) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Drive stream request failed with status ${res.status}: ${errText}`);
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
      // Ensure access token is refreshed/valid
      await this.getAccessToken();
      await this.drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
      console.log(`Successfully deleted file from Google Drive: ${fileId}`);
      return true;
    } catch (err: any) {
      if (err?.code === 404 || err?.status === 404 || err?.response?.status === 404) {
        console.log(`Google Drive file ${fileId} was already deleted / not found.`);
        return true;
      }
      console.error(`Failed to delete Google Drive file ${fileId}:`, err?.message || err, err?.response?.data);
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
