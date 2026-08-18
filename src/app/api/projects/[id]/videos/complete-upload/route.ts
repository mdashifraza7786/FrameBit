import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VideoAsset, VideoVersion, Notification, User } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { emitRealtimeEvent } from '@/lib/events';
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
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const {
      assetId,
      assetName,
      driveFileId,
      driveFolderId,
      filename,
      mimeType,
      size,
      duration,
      thumbnailUrl,
      changeNotes,
    } = await req.json();

    if (!driveFileId || !filename) {
      return NextResponse.json({ error: 'driveFileId and filename are required' }, { status: 400 });
    }

    await connectDB();

    let asset;
    let versionNumber = 1;

    const cleanName = assetName?.trim() || filename.replace(/\.[^/.]+$/, '');
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '.mp4';
    const targetDriveFilename = cleanName.endsWith(ext) ? cleanName : `${cleanName}${ext}`;

    if (assetId) {
      asset = await VideoAsset.findOne({ _id: assetId, projectId: project._id });
      if (!asset) {
        return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
      }
      versionNumber = asset.currentVersionNumber + 1;
      asset.currentVersionNumber = versionNumber;
      asset.status = 'Updated';
      if (thumbnailUrl) asset.thumbnailUrl = thumbnailUrl;
      await asset.save();
    } else {
      asset = await VideoAsset.create({
        projectId: project._id,
        name: cleanName,
        currentVersionNumber: 1,
        driveFolderId: driveFolderId || project.driveFolderId,
        thumbnailUrl: thumbnailUrl || undefined,
        status: 'In Review',
      });
      versionNumber = 1;
    }

    // Sync file name to Google Drive if needed
    try {
      const projectOwner = await User.findById(project.ownerId);
      const storage = getStorageProviderForUser(projectOwner);
      if (storage.updateFileName && !driveFileId.startsWith('drive_')) {
        await storage.updateFileName(driveFileId, targetDriveFilename);
      }
    } catch (renameErr) {
      console.warn('Could not sync name to Google Drive:', renameErr);
    }

    const videoVersion = await VideoVersion.create({
      assetId: asset._id,
      projectId: project._id,
      versionNumber,
      driveFileId,
      driveFolderId: driveFolderId || project.driveFolderId,
      filename: targetDriveFilename,
      mimeType: mimeType || 'video/mp4',
      size: Number(size || 0),
      duration: duration ? Number(duration) : 0,
      thumbnailUrl,
      uploadedBy: user._id,
      uploadStatus: 'completed',
      changeNotes: changeNotes || '',
    });

    // Notify project members (except the uploader)
    const memberUserIds = project.members
      .map((m) => m.userId.toString())
      .concat(project.ownerId.toString())
      .filter((uid) => uid !== user._id.toString());

    for (const memberId of memberUserIds) {
      await Notification.create({
        userId: memberId,
        actorId: user._id,
        type: 'version_uploaded',
        projectId: project._id,
        assetId: asset._id,
        message: `${user.name} uploaded updated version (${asset.name} v${versionNumber}) for review`,
      });
    }

    emitRealtimeEvent({
      type: 'notification:created',
      projectId: project._id.toString(),
      assetId: asset._id.toString(),
      data: { message: `Updated version v${versionNumber} uploaded for ${asset.name}` },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    emitRealtimeEvent({
      type: 'status:changed',
      projectId: project._id.toString(),
      assetId: asset._id.toString(),
      data: {
        assetId: asset._id.toString(),
        status: asset.status,
        updatedBy: user.name,
      },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    emitRealtimeEvent({
      type: 'version:created',
      projectId: project._id.toString(),
      assetId: asset._id.toString(),
      data: {
        asset,
        version: videoVersion,
      },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      asset,
      version: videoVersion,
    });
  } catch (error: any) {
    console.error('Complete upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete video upload' }, { status: 500 });
  }
}
