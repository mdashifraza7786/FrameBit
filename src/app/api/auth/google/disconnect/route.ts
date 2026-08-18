import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    user.googleTokens = undefined;
    user.googleAccountId = undefined;
    await user.save();

    return NextResponse.json({ success: true, message: 'Google Drive disconnected successfully' });
  } catch (error: any) {
    console.error('Google disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
