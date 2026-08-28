import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        googleAccountId: user.googleAccountId,
        googleDriveConnected: !!(user.googleTokens?.accessToken || user.googleTokens?.refreshToken),
        googleDriveRootFolderId: user.googleDriveRootFolderId,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching session user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, avatar } = await req.json();

    if (name) user.name = name.trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        googleDriveConnected: !!(user.googleTokens?.accessToken || user.googleTokens?.refreshToken),
      },
    });
  } catch (error: any) {
    console.error('Error updating session user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
