import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User, Project, VideoAsset, VideoVersion, Notification } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { getStorageProviderForUser, driveNotConnectedMessage } from '@/lib/storage';
import { emitRealtimeEvent } from '@/lib/events';
import { Readable } from 'stream';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, project } = await verifyProjectAccess(projectId, user._id.toString(), 'editor');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const assetId = formData.get('assetId') as string | null;
    const assetName = formData.get('assetName') as string | null;
    const changeNotes = formData.get('changeNotes') as string | null;
    const thumbnailUrl = formData.get('thumbnailUrl') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Project owner's storage credentials MUST ALWAYS be used for all project video assets
    await connectDB();
    const projectOwner = await User.findById(project.ownerId);
    if (!projectOwner) {
      return NextResponse.json({ error: 'Project owner account not found' }, { status: 404 });
    }
    const storage = getStorageProviderForUser(projectOwner);
    if (!storage) {
      return NextResponse.json(
        { error: driveNotConnectedMessage(projectOwner.name, projectOwner._id.toString() === user._id.toString()) },
        { status: 409 }
      );
    }

    // Convert Web File stream to Node Readable stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    const cleanName = assetName?.trim() || file.name.replace(/\.[^/.]+$/, '');
    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4';
    const targetDriveFilename = cleanName.endsWith(ext) ? cleanName : `${cleanName}${ext}`;

    const uploadedFile = await storage.upload({
      filename: targetDriveFilename,
      mimeType: file.type || 'video/mp4',
      stream,
      parentFolderId: project.driveFolderId,
    });

    let asset: any;
    let versionNumber = 1;

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
        driveFolderId: project.driveFolderId,
        thumbnailUrl: thumbnailUrl || undefined,
        status: 'In Review',
      });
      versionNumber = 1;
    }

    const newVersion = await VideoVersion.create({
      assetId: asset._id,
      projectId: project._id,
      versionNumber,
      filename: targetDriveFilename,
      driveFileId: uploadedFile.id,
      driveFolderId: project.driveFolderId,
      thumbnailUrl: thumbnailUrl || uploadedFile.thumbnailUrl || undefined,
      size: file.size,
      mimeType: file.type || 'video/mp4',
      uploadedBy: user._id,
      uploadStatus: 'completed',
      changeNotes: changeNotes || '',
    });

    await Project.findByIdAndUpdate(projectId, {
      updatedAt: new Date(),
    });

    // Notify other project members
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
        version: newVersion,
      },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      asset,
      version: newVersion,
    });
  } catch (error: any) {
    console.error('Upload proxy error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload video via stream proxy' }, { status: 500 });
  }
}
