import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import { ShareLink, VideoAsset, Project } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';

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

    await connectDB();
    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    const { allowed } = await verifyProjectAccess(asset.projectId.toString(), user._id.toString(), 'reviewer');
    if (!allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const shareLinks = await ShareLink.find({ assetId: asset._id }).sort({ createdAt: -1 });

    return NextResponse.json({ shareLinks });
  } catch (error: any) {
    console.error('Share GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

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

    await connectDB();
    const asset = await VideoAsset.findById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Video asset not found' }, { status: 404 });
    }

    const { allowed, userRole } = await verifyProjectAccess(asset.projectId.toString(), user._id.toString(), 'reviewer');
    if (!allowed || (userRole !== 'owner' && userRole !== 'reviewer')) {
      return NextResponse.json({ error: 'Only project owners and reviewers can create share links' }, { status: 403 });
    }

    const { allowComments = true, allowDownloads = false, expiresInDays } = await req.json();

    const token = crypto.randomBytes(16).toString('hex');
    let expiresAt: Date | undefined;
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(expiresInDays));
    }

    const shareLink = await ShareLink.create({
      token,
      projectId: asset.projectId,
      assetId: asset._id,
      versionNumber: asset.currentVersionNumber,
      createdBy: user._id,
      allowComments: Boolean(allowComments),
      allowDownloads: Boolean(allowDownloads),
      expiresAt,
      viewsCount: 0,
    });

    const appUrl = process.env.APP_URL || req.nextUrl.origin;
    const reviewUrl = `${appUrl}/review/${token}`;

    return NextResponse.json({
      shareLink,
      reviewUrl,
    });
  } catch (error: any) {
    console.error('Share creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
