import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project, VideoAsset } from '@/lib/models';
import { getSessionUser } from '@/lib/auth';
import { getStorageProviderForUser } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const projects = await Project.find({
      $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
    })
      .populate('ownerId', 'name email avatar')
      .populate('members.userId', 'name email avatar')
      .sort({ updatedAt: -1 });

    // Fetch video counts for each project
    const projectIds = projects.map((p) => p._id);
    const videoCounts = await VideoAsset.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    videoCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const enriched = projects.map((p) => {
      const isOwner = p.ownerId._id.toString() === user._id.toString();
      const member = p.members.find((m) => m.userId._id.toString() === user._id.toString());
      const role = isOwner ? 'owner' : member?.role || 'reviewer';

      return {
        id: p._id.toString(),
        name: p.name,
        description: p.description,
        owner: p.ownerId,
        driveFolderId: p.driveFolderId,
        membersCount: p.members.length + 1,
        videoCount: countMap[p._id.toString()] || 0,
        userRole: role,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (error: any) {
    console.error('Projects GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    await connectDB();

    // Every project needs somewhere to actually store its videos — refuse to create one otherwise.
    const storage = getStorageProviderForUser(user);
    if (!storage) {
      return NextResponse.json(
        { error: 'Connect your Google Drive before creating a project — it\'s where all project videos are stored.' },
        { status: 409 }
      );
    }

    let rootId = user.googleDriveRootFolderId;

    // If user doesn't have root folder ID saved yet, find or create "FrameBit"
    if (!rootId && 'findOrCreateFolder' in storage) {
      const rootFolder = await (storage as any).findOrCreateFolder('FrameBit');
      rootId = rootFolder.id;
      user.googleDriveRootFolderId = rootId;
      await user.save();
    }

    const folder = await storage.createFolder(name.trim(), rootId);
    const driveFolderId = folder.id;

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() || '',
      ownerId: user._id,
      driveFolderId,
      members: [],
    });

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        ownerId: project.ownerId,
        driveFolderId: project.driveFolderId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Project creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
