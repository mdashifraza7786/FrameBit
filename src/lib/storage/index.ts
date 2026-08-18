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

  if (!forceLocal && user?.googleTokens?.accessToken) {
    const accessToken = decrypt(user.googleTokens.accessToken);
    const refreshToken = user.googleTokens.refreshToken ? decrypt(user.googleTokens.refreshToken) : undefined;
    const expiryDate = user.googleTokens.expiryDate;

    if (accessToken) {
      return new GoogleDriveStorageProvider({
        accessToken,
        refreshToken,
        expiryDate,
      });
    }
  }

  // Fallback to local storage provider
  return new LocalStorageProvider();
}
