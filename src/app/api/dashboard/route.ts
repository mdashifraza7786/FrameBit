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

    await connectDB();

    const projects = await Project.find({
      $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
    })
      .sort({ updatedAt: -1 })
      .populate('ownerId', 'name email avatar');

    const projectIds = projects.map((p) => p._id);

    // Fetch video assets across user's projects
    const videos = await VideoAsset.find({ projectId: { $in: projectIds } })
      .populate('projectId', 'name')
      .sort({ updatedAt: -1 });

    const totalProjects = projects.length;
    const totalVideos = videos.length;
    const waitingForReview = videos.filter((v) => v.status === 'In Review').length;
    const changesRequested = videos.filter((v) => v.status === 'Changes Requested').length;
    const approvedVideos = videos.filter((v) => v.status === 'Approved').length;

    const unresolvedComments = await Comment.countDocuments({
      projectId: { $in: projectIds },
      resolved: false,
    });

    return NextResponse.json({
      metrics: {
        totalProjects,
        totalVideos,
        waitingForReview,
        changesRequested,
        approvedVideos,
        unresolvedComments,
      },
      recentProjects: projects.slice(0, 6).map((p) => ({
        id: p._id.toString(),
        name: p.name,
        description: p.description,
        owner: p.ownerId,
        membersCount: p.members.length + 1,
        updatedAt: p.updatedAt,
      })),
      recentVideos: videos.slice(0, 10).map((v: any) => ({
        id: v._id.toString(),
        projectId: v.projectId?._id?.toString(),
        projectName: v.projectId?.name || 'Project',
        name: v.name,
        thumbnailUrl: v.thumbnailUrl || undefined,
        status: v.status,
        currentVersionNumber: v.currentVersionNumber,
        updatedAt: v.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
