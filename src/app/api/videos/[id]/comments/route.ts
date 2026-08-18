import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VideoAsset, Comment, ShareLink, Project } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { emitRealtimeEvent } from '@/lib/events';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const shareToken = searchParams.get('token');

    await connectDB();
    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    const project = await Project.findById(asset.projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let user = await getSessionUser(req);
    let guestName: string | undefined;

    if (shareToken) {
      const shareLink = await ShareLink.findOne({ token: shareToken, assetId: asset._id });
      if (!shareLink || (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date())) {
        return NextResponse.json({ error: 'Invalid or expired share link' }, { status: 403 });
      }
      if (!shareLink.allowComments) {
        return NextResponse.json({ error: 'Commenting is disabled for this share link' }, { status: 403 });
      }
    } else {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const check = await verifyProjectAccess(project._id.toString(), user._id.toString(), 'reviewer');
      if (!check.allowed) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const { text, timestamp, timestampEnd, frameNumber, versionNumber, parentCommentId, authorName, x, y, drawingData } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    if (!user) {
      guestName = authorName?.trim() || 'Guest Reviewer';
    }

    const comment = await Comment.create({
      projectId: asset.projectId,
      assetId: asset._id,
      versionNumber: versionNumber || asset.currentVersionNumber,
      userId: user ? user._id : undefined,
      guestName,
      text: text.trim(),
      timestamp: typeof timestamp === 'number' ? timestamp : 0,
      timestampEnd: typeof timestampEnd === 'number' && timestampEnd > timestamp ? timestampEnd : undefined,
      frameNumber: typeof frameNumber === 'number' ? frameNumber : undefined,
      x: typeof x === 'number' ? x : undefined,
      y: typeof y === 'number' ? y : undefined,
      drawingData: typeof drawingData === 'string' ? drawingData : undefined,
      parentCommentId: parentCommentId || null,
      resolved: false,
    });

    await comment.populate('userId', 'name email avatar role');

    // No notifications are sent for comments (including @mentions) — only the
    // realtime SSE broadcast below, so the comment shows up live without spamming
    // the notification list.

    // Broadcast SSE realtime event
    emitRealtimeEvent({
      type: 'comment:created',
      projectId: project._id.toString(),
      assetId: asset._id.toString(),
      data: comment,
      actorId: user?._id?.toString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ comment });
  } catch (error: any) {
    console.error('Comment creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
