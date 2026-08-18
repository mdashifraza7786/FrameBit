import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project, VideoAsset, Comment } from '@/lib/models';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q || q.length < 2) {
      return NextResponse.json({ projects: [], videos: [], comments: [] });
    }

    await connectDB();

    // Find all projects user has access to
    const userProjects = await Project.find({
      $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
    }).select('_id name');

    const projectIds = userProjects.map((p) => p._id);

    const regex = new RegExp(q, 'i');

    // 1. Matching projects
    const matchedProjects = await Project.find({
      _id: { $in: projectIds },
      $or: [{ name: regex }, { description: regex }],
    })
      .select('name description updatedAt')
      .limit(8);

    // 2. Matching videos
    const matchedVideos = await VideoAsset.find({
      projectId: { $in: projectIds },
      name: regex,
    })
      .populate('projectId', 'name')
      .limit(10);

    // 3. Matching comments
    const matchedComments = await Comment.find({
      projectId: { $in: projectIds },
      text: regex,
    })
      .populate('assetId', 'name')
      .populate('userId', 'name avatar')
      .limit(10);

    return NextResponse.json({
      projects: matchedProjects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        description: p.description,
        type: 'project',
      })),
      videos: matchedVideos.map((v: any) => ({
        id: v._id.toString(),
        projectId: v.projectId?._id?.toString(),
        projectName: v.projectId?.name,
        name: v.name,
        status: v.status,
        version: v.currentVersionNumber,
        type: 'video',
      })),
      comments: matchedComments.map((c: any) => ({
        id: c._id.toString(),
        assetId: c.assetId?._id?.toString(),
        assetName: c.assetId?.name,
        text: c.text,
        timestamp: c.timestamp,
        author: c.userId?.name || 'Guest',
        type: 'comment',
      })),
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
