import { StorageProvider } from './types';
import { GoogleDriveStorageProvider } from './GoogleDriveStorageProvider';
import { IUser } from '../models';
import { decrypt } from '../crypto';

export * from './types';
export * from './GoogleDriveStorageProvider';

/**
 * Google Drive is the only supported storage backend — there is no local-disk fallback (a serverless
 * deployment's filesystem is read-only, so a "local storage" fallback can never work there anyway).
 * Returns null when the given user has no usable Drive connection; callers must handle that explicitly
 * rather than let a storage call throw deep inside an upload/stream/delete path.
 */
export function getStorageProviderForUser(user?: IUser | null): StorageProvider | null {
  if (!user?.googleTokens || (!user.googleTokens.accessToken && !user.googleTokens.refreshToken)) {
    return null;
  }

  try {
    const accessToken = user.googleTokens.accessToken ? decrypt(user.googleTokens.accessToken) : undefined;
    const refreshToken = user.googleTokens.refreshToken ? decrypt(user.googleTokens.refreshToken) : undefined;
    const expiryDate = user.googleTokens.expiryDate;

    if (!accessToken && !refreshToken) return null;

    return new GoogleDriveStorageProvider(
      {
        accessToken: accessToken || undefined,
        refreshToken: refreshToken || undefined,
        expiryDate,
      },
      user._id.toString()
    );
  } catch (tokenErr) {
    console.error('Error decrypting Google Drive tokens for user:', tokenErr);
    return null;
  }
}

/**
 * The message shown when a project's owner hasn't connected Google Drive — every project video is stored
 * in the owner's Drive, so nobody else can fix this. Tells the requester exactly who to go ask.
 */
export function driveNotConnectedMessage(ownerName: string, requesterIsOwner: boolean): string {
  return requesterIsOwner
    ? 'Connect your Google Drive in Settings to continue — it\'s where this project\'s videos are stored.'
    : `Contact the project owner (${ownerName}) to connect their Google Drive account to access this project.`;
}
