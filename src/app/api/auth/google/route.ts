import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to connect Google Drive' }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'Google OAuth credentials not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local',
        },
        { status: 503 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const state = user._id.toString();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });

    const isDirect = req.nextUrl.searchParams.get('direct') === 'true';
    if (isDirect) {
      return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Google OAuth initiation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate Google OAuth' }, { status: 500 });
  }
}
