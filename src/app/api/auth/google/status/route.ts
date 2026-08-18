import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isConnected = !!(user.googleTokens && user.googleTokens.accessToken);
    let rootFolderId = user.googleDriveRootFolderId || null;

    // If connected but rootFolderId is missing, find or create FrameBit folder
    if (isConnected && !rootFolderId) {
      try {
        const { getStorageProviderForUser } = await import('@/lib/storage');
        const storage = getStorageProviderForUser(user);
        if ('findOrCreateFolder' in storage) {
          const rootFolder = await (storage as any).findOrCreateFolder('FrameBit');
          rootFolderId = rootFolder.id;
          user.googleDriveRootFolderId = rootFolder.id || undefined;
          await user.save();
        }
      } catch (err) {
        console.warn('Could not resolve root folder during status check:', err);
      }
    }

    const folderUrl = rootFolderId ? `https://drive.google.com/drive/folders/${rootFolderId}` : null;

    return NextResponse.json({
      connected: isConnected,
      googleAccountId: user.googleAccountId || null,
      rootFolderId,
      folderUrl,
      expiryDate: user.googleTokens?.expiryDate || null,
    });
  } catch (error: any) {
    console.error('Google status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
