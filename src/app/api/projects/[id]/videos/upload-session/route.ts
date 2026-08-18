import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { getStorageProviderForUser } from '@/lib/storage';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, project } = await verifyProjectAccess(id, user._id.toString(), 'editor');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Permission denied. Only editors and owners can upload videos.' }, { status: 403 });
    }

    const { filename, mimeType, size } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Try using user's storage provider, or fallback to project owner's tokens
    await connectDB();
    let storage = getStorageProviderForUser(user);
    if (!user.googleTokens?.accessToken && project.ownerId.toString() !== user._id.toString()) {
      const owner = await User.findById(project.ownerId);
      if (owner?.googleTokens?.accessToken) {
        storage = getStorageProviderForUser(owner);
      }
    }

    const origin = req.headers.get('origin') || req.nextUrl.origin || 'http://localhost:3000';

    const uploadSession = await storage.initiateResumableUpload({
      filename,
      mimeType: mimeType || 'video/mp4',
      size: size ? Number(size) : undefined,
      parentFolderId: project.driveFolderId,
      origin,
    });

    return NextResponse.json({
      uploadUrl: uploadSession.uploadUrl,
      driveFolderId: project.driveFolderId,
      filename,
    });
  } catch (error: any) {
    console.error('Upload session initiation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate upload session' }, { status: 500 });
  }
}
