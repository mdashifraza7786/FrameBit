import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Comment, Notification, Project, VideoAsset } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { emitRealtimeEvent } from '@/lib/events';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const { allowed, project, userRole } = await verifyProjectAccess(
      comment.projectId.toString(),
      user._id.toString(),
      'reviewer'
    );
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await req.json();
    const { text, resolved } = body;

    // Handle text edit
    if (text !== undefined) {
      const isAuthor = comment.userId?.toString() === user._id.toString();
      const isOwner = userRole === 'owner';
      if (!isAuthor && !isOwner) {
        return NextResponse.json({ error: 'Only the author can edit this comment' }, { status: 403 });
      }
      comment.text = text.trim();
    }

    // Handle resolve / reopen
    if (resolved !== undefined) {
      comment.resolved = Boolean(resolved);
      comment.resolvedBy = resolved ? user._id : undefined;
      comment.resolvedAt = resolved ? new Date() : undefined;

      // If comment was resolved, notify comment author if not the resolver
      if (resolved && comment.userId && comment.userId.toString() !== user._id.toString()) {
        const asset = await VideoAsset.findById(comment.assetId);
        await Notification.create({
          userId: comment.userId,
          actorId: user._id,
          type: 'comment_resolved',
          projectId: project._id,
          assetId: comment.assetId,
          commentId: comment._id,
          message: `${user.name} resolved your comment on "${asset?.name || 'video'}"`,
        });

        emitRealtimeEvent({
          type: 'notification:created',
          projectId: project._id.toString(),
          assetId: comment.assetId.toString(),
          data: { message: `Comment resolved on ${asset?.name}` },
          actorId: user._id.toString(),
          timestamp: new Date().toISOString(),
        });
      }
    }

    await comment.save();
    await comment.populate('userId', 'name email avatar role');
    await comment.populate('resolvedBy', 'name email');

    emitRealtimeEvent({
      type: resolved !== undefined ? 'comment:resolved' : 'comment:updated',
      projectId: comment.projectId.toString(),
      assetId: comment.assetId.toString(),
      data: comment,
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ comment });
  } catch (error: any) {
    console.error('Comment update error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const { allowed, userRole } = await verifyProjectAccess(
      comment.projectId.toString(),
      user._id.toString(),
      'reviewer'
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const isAuthor = comment.userId?.toString() === user._id.toString();
    const isOwnerOrEditor = userRole === 'owner' || userRole === 'editor';
    if (!isAuthor && !isOwnerOrEditor) {
      return NextResponse.json({ error: 'You do not have permission to delete this comment' }, { status: 403 });
    }

    // Delete comment and replies
    await Comment.deleteMany({
      $or: [{ _id: comment._id }, { parentCommentId: comment._id }],
    });

    emitRealtimeEvent({
      type: 'comment:deleted',
      projectId: comment.projectId.toString(),
      assetId: comment.assetId.toString(),
      data: { commentId },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Comment deleted' });
  } catch (error: any) {
    console.error('Comment delete error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
