import { StorageProvider } from './types';
import { GoogleDriveStorageProvider } from './GoogleDriveStorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { IUser } from '../models';
import { decrypt } from '../crypto';

export * from './types';
export * from './GoogleDriveStorageProvider';
export * from './LocalStorageProvider';

export function getStorageProviderForUser(user?: IUser | null): StorageProvider {
  const forceLocal = process.env.STORAGE_PROVIDER === 'local';

  if (!forceLocal && user?.googleTokens && (user.googleTokens.accessToken || user.googleTokens.refreshToken)) {
    try {
      const accessToken = user.googleTokens.accessToken ? decrypt(user.googleTokens.accessToken) : undefined;
      const refreshToken = user.googleTokens.refreshToken ? decrypt(user.googleTokens.refreshToken) : undefined;
      const expiryDate = user.googleTokens.expiryDate;

      if (accessToken || refreshToken) {
        return new GoogleDriveStorageProvider(
          {
            accessToken: accessToken || undefined,
            refreshToken: refreshToken || undefined,
            expiryDate,
          },
          user._id.toString()
        );
      }
    } catch (tokenErr) {
      console.error('Error decrypting Google Drive tokens for user:', tokenErr);
    }
  }

  // Fallback to local storage provider
  return new LocalStorageProvider();
}
