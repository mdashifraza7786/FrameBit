import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { encrypt } from '@/lib/crypto';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.APP_URL || req.nextUrl.origin;

    if (error) {
      console.error('Google OAuth callback error:', error);
      return NextResponse.redirect(`${appUrl}/settings?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${appUrl}/settings?error=missing_code`);
    }

    await connectDB();
    let user = await getSessionUser(req);

    if (!user && state) {
      user = await User.findById(state);
    }

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=session_expired`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Get user's Google account info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    let googleAccountId: string | undefined;
    try {
      const userInfo = await oauth2.userinfo.get();
      googleAccountId = userInfo.data.email || undefined;
    } catch {
      // Non-fatal if userinfo fails
    }

    // Check or create root application folder: "FrameBit"
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    let rootFolderId: string | undefined;

    const listRes = await drive.files.list({
      q: "name = 'FrameBit' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      rootFolderId = listRes.data.files[0].id || undefined;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: 'FrameBit',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, name',
      });
      rootFolderId = createRes.data.id || undefined;
    }

    // Encrypt and persist tokens
    const encryptedAccessToken = tokens.access_token ? encrypt(tokens.access_token) : undefined;
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : user.googleTokens?.refreshToken;

    user.googleTokens = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiryDate: tokens.expiry_date || undefined,
      scope: tokens.scope || undefined,
      tokenType: tokens.token_type || undefined,
    };
    if (googleAccountId) {
      user.googleAccountId = googleAccountId;
    }
    if (rootFolderId) {
      user.googleDriveRootFolderId = rootFolderId;
    }

    await user.save();

    return NextResponse.redirect(`${appUrl}/settings?drive_connected=true`);
  } catch (error: any) {
    console.error('Google OAuth callback handler error:', error);
    const appUrl = process.env.APP_URL || req.nextUrl.origin;
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(error.message || 'oauth_exchange_failed')}`
    );
  }
}
