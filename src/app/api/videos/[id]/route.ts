import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VideoAsset, VideoVersion, Comment, Project, Notification, User } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { emitRealtimeEvent } from '@/lib/events';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    const project = await Project.findById(asset.projectId)
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar');

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let userRole = 'guest';
    const user = await getSessionUser(req);
    if (user) {
      const check = await verifyProjectAccess(project._id.toString(), user._id.toString(), 'reviewer');
      if (check.allowed) {
        userRole = check.userRole || 'reviewer';
      }
    }

    // Whether the project owner's Drive is connected — never expose the tokens themselves, just the flag,
    // so the client can show a "connect Drive" locked state instead of a broken video player.
    const ownerAuthDoc = await User.findById(project.ownerId._id).select('googleTokens');
    const ownerDriveConnected = !!(ownerAuthDoc?.googleTokens?.accessToken || ownerAuthDoc?.googleTokens?.refreshToken);

    // Fetch all versions
    const versions = await VideoVersion.find({ assetId: asset._id })
      .populate('uploadedBy', 'name email avatar')
      .sort({ versionNumber: -1 });

    // Fetch all comments
    const comments = await Comment.find({ assetId: asset._id })
      .populate('userId', 'name email avatar role')
      .populate('resolvedBy', 'name email')
      .sort({ timestamp: 1, createdAt: 1 });

    return NextResponse.json({
      asset,
      project,
      ownerDriveConnected,
      versions,
      comments,
      userRole,
      currentUser: user
        ? {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Video GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    const { allowed, project, userRole } = await verifyProjectAccess(
      asset.projectId.toString(),
      user._id.toString(),
      'reviewer'
    );
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { name, status, currentVersionNumber } = await req.json();

    if (name && (userRole === 'owner' || userRole === 'editor')) {
      asset.name = name.trim();
    }

    if (currentVersionNumber && Number.isInteger(currentVersionNumber)) {
      asset.currentVersionNumber = currentVersionNumber;
    }

    if (status && ['Draft', 'In Review', 'Changes Requested', 'Approved', 'Updated'].includes(status)) {
      if (userRole !== 'owner' && userRole !== 'reviewer') {
        return NextResponse.json(
          { error: 'Only reviewers or project owners can change the review approval status' },
          { status: 403 }
        );
      }
      const oldStatus = asset.status;
      asset.status = status;

      // Broadcast review status change
      emitRealtimeEvent({
        type: 'status:changed',
        projectId: project._id.toString(),
        assetId: asset._id.toString(),
        data: {
          assetId: asset._id.toString(),
          status,
          oldStatus,
          updatedBy: user.name,
        },
        actorId: user._id.toString(),
        timestamp: new Date().toISOString(),
      });

      // Notify project owner/editors/reviewers
      const targetUserIds = project.members
        .map((m) => m.userId.toString())
        .concat(project.ownerId.toString())
        .filter((uid) => uid !== user._id.toString());

      for (const targetId of targetUserIds) {
        await Notification.create({
          userId: targetId,
          actorId: user._id,
          type: 'status_changed',
          projectId: project._id,
          assetId: asset._id,
          message: `${user.name} marked "${asset.name}" as "${status}"`,
        });
      }

      emitRealtimeEvent({
        type: 'notification:created',
        projectId: project._id.toString(),
        assetId: asset._id.toString(),
        data: { message: `Status updated to ${status}` },
        actorId: user._id.toString(),
        timestamp: new Date().toISOString(),
      });
    }

    if (currentVersionNumber && Number.isInteger(currentVersionNumber) && currentVersionNumber !== asset.currentVersionNumber) {
      asset.currentVersionNumber = currentVersionNumber;
      
      const targetUserIds = project.members
        .map((m) => m.userId.toString())
        .concat(project.ownerId.toString())
        .filter((uid) => uid !== user._id.toString());

      for (const targetId of targetUserIds) {
        await Notification.create({
          userId: targetId,
          actorId: user._id,
          type: 'version_uploaded',
          projectId: project._id,
          assetId: asset._id,
          message: `${user.name} switched "${asset.name}" to version v${currentVersionNumber}`,
        });
      }

      emitRealtimeEvent({
        type: 'notification:created',
        projectId: project._id.toString(),
        assetId: asset._id.toString(),
        data: { message: `Version updated to v${currentVersionNumber}` },
        actorId: user._id.toString(),
        timestamp: new Date().toISOString(),
      });
    }

    await asset.save();

    return NextResponse.json({ asset });
  } catch (error: any) {
    console.error('Video PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const versionParam = searchParams.get('version');

    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    const { allowed, project } = await verifyProjectAccess(
      asset.projectId.toString(),
      user._id.toString(),
      'editor'
    );
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { getStorageProviderForUser } = await import('@/lib/storage');
    const { User, ShareLink, Notification } = await import('@/lib/models');
    const projectOwner = await User.findById(project.ownerId);
    const storage = getStorageProviderForUser(projectOwner);

    // Scenario A: Delete a specific version (e.g. v2)
    if (versionParam) {
      const targetVersionNumber = parseInt(versionParam, 10);
      const targetVersion = await VideoVersion.findOne({
        assetId: id,
        versionNumber: targetVersionNumber,
      });

      if (!targetVersion) {
        return NextResponse.json({ error: `Version ${targetVersionNumber} not found` }, { status: 404 });
      }

      // 1. Delete file from Google Drive
      if (targetVersion.driveFileId) {
        try {
          const success = await storage?.delete(targetVersion.driveFileId);
          console.log(`Version v${targetVersionNumber} file (${targetVersion.driveFileId}) deletion status:`, success);
        } catch (driveErr) {
          console.warn(`Could not delete Drive file ${targetVersion.driveFileId}:`, driveErr);
        }
      }

      // 2. Delete version document
      await VideoVersion.findByIdAndDelete(targetVersion._id);

      // 3. Delete comments specific to this version
      await Comment.deleteMany({ assetId: id, versionNumber: targetVersionNumber });

      // 4. Check remaining versions
      const remainingVersions = await VideoVersion.find({ assetId: id }).sort({ versionNumber: -1 });

      if (remainingVersions.length === 0) {
        // No versions left, delete the entire asset
        await VideoAsset.findByIdAndDelete(id);
        await ShareLink.deleteMany({ assetId: id });
        await Notification.deleteMany({ assetId: id });

        emitRealtimeEvent({
          type: 'asset:deleted',
          projectId: project._id.toString(),
          assetId: id,
          data: { id },
          actorId: user._id.toString(),
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          deletedAsset: true,
          message: 'Deleted last version and video asset',
        });
      }

      // If active version was deleted, fallback to latest remaining version
      let nextVersionNumber = asset.currentVersionNumber;
      if (asset.currentVersionNumber === targetVersionNumber) {
        nextVersionNumber = remainingVersions[0].versionNumber;
        asset.currentVersionNumber = nextVersionNumber;
        // Always refresh — clear to undefined if the fallback version has no thumbnail of
        // its own, so the thumbnail route re-resolves it instead of showing the deleted
        // version's stale cached image.
        asset.thumbnailUrl = remainingVersions[0].thumbnailUrl || undefined;
        await asset.save();
      }

      emitRealtimeEvent({
        type: 'version:deleted',
        projectId: project._id.toString(),
        assetId: id,
        data: {
          deletedVersion: targetVersionNumber,
          currentVersionNumber: nextVersionNumber,
          remainingCount: remainingVersions.length,
        },
        actorId: user._id.toString(),
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        deletedVersion: targetVersionNumber,
        currentVersionNumber: nextVersionNumber,
        remainingVersionsCount: remainingVersions.length,
        message: `Version v${targetVersionNumber} deleted successfully`,
      });
    }

    // Scenario B: Delete entire video asset and all its versions
    const allVersions = await VideoVersion.find({ assetId: id });
    for (const ver of allVersions) {
      if (ver.driveFileId) {
        try {
          await storage?.delete(ver.driveFileId);
        } catch (driveErr) {
          console.warn(`Could not delete Drive file ${ver.driveFileId}:`, driveErr);
        }
      }
    }

    await VideoAsset.findByIdAndDelete(id);
    await VideoVersion.deleteMany({ assetId: id });
    await Comment.deleteMany({ assetId: id });
    await ShareLink.deleteMany({ assetId: id });
    await Notification.deleteMany({ assetId: id });

    emitRealtimeEvent({
      type: 'asset:deleted',
      projectId: project._id.toString(),
      assetId: id,
      data: { id },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      deletedAsset: true,
      message: 'Video asset and all versions deleted',
    });
  } catch (error: any) {
    console.error('Video DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
