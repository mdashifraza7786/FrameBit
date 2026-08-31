import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VideoAsset, VideoVersion, Project, User, ShareLink } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { getStorageProviderForUser, driveNotConnectedMessage } from '@/lib/storage';
import { Readable } from 'stream';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const versionParam = searchParams.get('version');
    const shareToken = searchParams.get('token');

    await connectDB();
    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    let hasAccess = false;
    let sessionUser = null;
    let project = await Project.findById(asset.projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Check share token if provided
    if (shareToken) {
      const shareLink = await ShareLink.findOne({
        token: shareToken,
        assetId: asset._id,
      });

      if (shareLink) {
        if (!shareLink.expiresAt || new Date(shareLink.expiresAt) > new Date()) {
          hasAccess = true;
        }
      }
    }

    // 2. Check session user if not authorized by token
    if (!hasAccess) {
      sessionUser = await getSessionUser(req);
      if (sessionUser) {
        const check = await verifyProjectAccess(project._id.toString(), sessionUser._id.toString(), 'reviewer');
        if (check.allowed) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized to view this video' }, { status: 403 });
    }

    // Target version
    const versionNumber = versionParam ? parseInt(versionParam, 10) : asset.currentVersionNumber;
    const version = await VideoVersion.findOne({
      assetId: asset._id,
      versionNumber,
    });

    if (!version) {
      return NextResponse.json({ error: 'Video version not found' }, { status: 404 });
    }

    // Get owner's storage credentials to stream the file
    const projectOwner = await User.findById(project.ownerId);
    const storage = getStorageProviderForUser(projectOwner);
    if (!storage || !projectOwner) {
      const requesterIsOwner = !!sessionUser && projectOwner?._id.toString() === sessionUser._id.toString();
      return NextResponse.json(
        {
          error: driveNotConnectedMessage(projectOwner?.name || 'the project owner', requesterIsOwner),
          code: 'drive_not_connected',
        },
        { status: 409 }
      );
    }

    const rangeHeader = req.headers.get('range') || undefined;
    const streamResult = await storage.getStream(version.driveFileId, rangeHeader);

    const responseHeaders: Record<string, string> = {
      'Content-Type': streamResult.contentType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
    };

    if (streamResult.contentLength > 0) {
      responseHeaders['Content-Length'] = streamResult.contentLength.toString();
    }

    if (streamResult.contentRange) {
      responseHeaders['Content-Range'] = streamResult.contentRange;
    }

    return new Response(streamResult.stream as any, {
      status: streamResult.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Video stream error:', error);
    return NextResponse.json({ error: error.message || 'Error streaming video' }, { status: 500 });
  }
}
