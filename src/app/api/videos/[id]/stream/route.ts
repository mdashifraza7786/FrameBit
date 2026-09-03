import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VideoAsset, VideoVersion, Project, User, ShareLink } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { getStorageProviderForUser, driveNotConnectedMessage } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

async function resolveVideoStreamContext(
  req: NextRequest,
  id: string
) {
  const { searchParams } = new URL(req.url);
  const versionParam = searchParams.get('version');
  const shareToken = searchParams.get('token');

  await connectDB();
  const asset = await VideoAsset.findById(id);
  if (!asset) {
    return { error: 'Video asset not found', status: 404 };
  }

  let hasAccess = false;
  let sessionUser = null;
  const project = await Project.findById(asset.projectId);
  if (!project) {
    return { error: 'Project not found', status: 404 };
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
    return { error: 'Unauthorized to view this video', status: 403 };
  }

  // Target version
  const versionNumber = versionParam ? parseInt(versionParam, 10) : asset.currentVersionNumber;
  const version = await VideoVersion.findOne({
    assetId: asset._id,
    versionNumber,
  });

  if (!version) {
    return { error: 'Video version not found', status: 404 };
  }

  const projectOwner = await User.findById(project.ownerId);
  return { asset, project, version, projectOwner, sessionUser };
}

// Support HEAD requests for browser media probes (crucial for Safari/iOS WebKit range probing)
export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await resolveVideoStreamContext(req, id);
    if ('error' in ctx) {
      return new Response(null, { status: ctx.status });
    }

    const { version } = ctx;
    const headers: Record<string, string> = {
      'Content-Type': version.mimeType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': 'inline',
    };

    if (version.size && version.size > 0) {
      headers['Content-Length'] = version.size.toString();
    }

    return new Response(null, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Video HEAD stream error:', error);
    return new Response(null, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await resolveVideoStreamContext(req, id);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { projectOwner, sessionUser, version } = ctx;
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
      'Content-Type': streamResult.contentType || version.mimeType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
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
