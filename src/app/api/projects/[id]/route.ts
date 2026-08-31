import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project, VideoAsset, VideoVersion, Comment, User } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { getStorageProviderForUser } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, project, userRole } = await verifyProjectAccess(id, user._id.toString(), 'reviewer');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
    }

    const [ownerAuthDoc, videoAssets] = await Promise.all([
      User.findById(project.ownerId).select('googleTokens').lean(),
      VideoAsset.find({ projectId: project._id }).sort({ updatedAt: -1 }).lean(),
      project.populate('ownerId', 'name email avatar'),
      project.populate('members.userId', 'name email avatar'),
    ]);

    const ownerDriveConnected = !!(
      ownerAuthDoc?.googleTokens?.accessToken || ownerAuthDoc?.googleTokens?.refreshToken
    );

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        owner: project.ownerId,
        driveFolderId: project.driveFolderId,
        members: project.members,
        userRole,
        ownerDriveConnected,
        videoCount: videoAssets.length,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      videoAssets,
    });
  } catch (error: any) {
    console.error('Project GET error:', error);
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

    const { allowed, project } = await verifyProjectAccess(id, user._id.toString(), 'editor');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { name, description } = await req.json();
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();

    await project.save();

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Project PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, project } = await verifyProjectAccess(id, user._id.toString(), 'owner');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Only the project owner can delete this project' }, { status: 403 });
    }

    await connectDB();

    // Clean up project Drive folder if available (skipped if Drive isn't connected — the DB records are
    // still removed below either way, so a disconnected owner can still delete their own project).
    if (project.driveFolderId) {
      try {
        const storage = getStorageProviderForUser(user);
        await storage?.delete(project.driveFolderId);
      } catch (e) {
        console.warn('Could not delete Drive folder:', e);
      }
    }

    // Clean up all video assets, versions, comments
    await VideoAsset.deleteMany({ projectId: project._id });
    await VideoVersion.deleteMany({ projectId: project._id });
    await Comment.deleteMany({ projectId: project._id });
    await Project.findByIdAndDelete(project._id);

    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    console.error('Project DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
