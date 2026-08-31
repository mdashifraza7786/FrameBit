import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ShareLink, VideoAsset, VideoVersion, Comment, Project } from '@/lib/models';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    await connectDB();

    const shareLink = await ShareLink.findOne({ token });
    if (!shareLink) {
      return NextResponse.json({ error: 'Review link not found or invalid' }, { status: 404 });
    }

    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This review link has expired' }, { status: 410 });
    }

    // Non-blocking view count increment
    ShareLink.updateOne({ _id: shareLink._id }, { $inc: { viewsCount: 1 } }).catch(() => {});

    const asset = await VideoAsset.findById(shareLink.assetId).lean();
    if (!asset) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const [project, versions, comments] = await Promise.all([
      Project.findById(asset.projectId).select('name description').lean(),
      VideoVersion.find({ assetId: asset._id }).sort({ versionNumber: -1 }).lean(),
      Comment.find({ assetId: asset._id })
        .populate('userId', 'name email avatar role')
        .populate('resolvedBy', 'name email')
        .sort({ timestamp: 1, createdAt: 1 })
        .lean(),
    ]);

    return NextResponse.json({
      asset,
      project,
      versions,
      comments,
      shareLink: {
        token: shareLink.token,
        allowComments: shareLink.allowComments,
        allowDownloads: shareLink.allowDownloads,
        expiresAt: shareLink.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('Review token error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
