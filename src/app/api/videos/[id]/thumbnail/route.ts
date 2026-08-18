import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VideoAsset, VideoVersion, Project, User } from '@/lib/models';
import { getStorageProviderForUser } from '@/lib/storage';

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

    // 1. If asset has direct base64/URL thumbnail
    if (asset.thumbnailUrl) {
      if (asset.thumbnailUrl.startsWith('data:image')) {
        const parts = asset.thumbnailUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const buffer = Buffer.from(parts[1], 'base64');
        return new Response(buffer, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
      return NextResponse.redirect(asset.thumbnailUrl);
    }

    // 2. Fetch from VideoVersion or Google Drive
    const version = await VideoVersion.findOne({
      assetId: asset._id,
      versionNumber: asset.currentVersionNumber,
    });

    if (version?.thumbnailUrl) {
      if (version.thumbnailUrl.startsWith('data:image')) {
        const parts = version.thumbnailUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const buffer = Buffer.from(parts[1], 'base64');
        return new Response(buffer, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
      return NextResponse.redirect(version.thumbnailUrl);
    }

    // 3. Try fetching thumbnailLink from Google Drive API
    if (version?.driveFileId && !version.driveFileId.startsWith('drive_')) {
      try {
        const project = await Project.findById(asset.projectId);
        if (project) {
          const owner = await User.findById(project.ownerId);
          if (owner) {
            const storage = getStorageProviderForUser(owner);
            const meta = await storage.getMetadata(version.driveFileId);
            if (meta.thumbnailUrl) {
              // Cache on asset for next time
              asset.thumbnailUrl = meta.thumbnailUrl;
              await asset.save();
              return NextResponse.redirect(meta.thumbnailUrl);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch Google Drive thumbnail:', err);
      }
    }

    // 4. Default high-precision Studio Video Thumbnail SVG placeholder
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" fill="none">
        <rect width="640" height="360" fill="#090a0f"/>
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#008b8b" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#090a0f" stop-opacity="0.9"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#g)"/>
        <circle cx="320" cy="180" r="40" fill="#008b8b" fill-opacity="0.2" stroke="#008b8b" stroke-width="2"/>
        <polygon points="312,165 336,180 312,195" fill="#2dd4bf"/>
        <text x="320" y="250" fill="#94a3b8" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="600" text-anchor="middle" letter-spacing="1">FRAMEBIT PREVIEW</text>
      </svg>
    `;

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Thumbnail route error:', error);
    return NextResponse.json({ error: error.message || 'Error fetching thumbnail' }, { status: 500 });
  }
}
