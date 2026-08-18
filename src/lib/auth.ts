import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User, IUser, UserRole, Project, IProject } from './models';

const JWT_SECRET = process.env.JWT_SECRET || 'frame-app-default-jwt-secret-key-32chars';
const COOKIE_NAME = 'frame_token';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function getSessionUser(req: NextRequest): Promise<IUser | null> {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload?.userId) return null;

    await connectDB();
    const user = await User.findById(payload.userId);
    return user;
  } catch (err) {
    console.error('Error in getSessionUser:', err);
    return null;
  }
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  reviewer: 1,
  editor: 2,
  owner: 3,
};

export function isRoleSufficient(currentRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function verifyProjectAccess(
  projectId: string,
  userId: string,
  minRole: UserRole = 'reviewer'
): Promise<{ allowed: boolean; project?: IProject; userRole?: UserRole }> {
  await connectDB();
  const project = await Project.findById(projectId);
  if (!project) return { allowed: false };

  // If user is owner of the project
  if (project.ownerId.toString() === userId) {
    return { allowed: true, project, userRole: 'owner' };
  }

  // Check project membership
  const member = project.members.find((m) => m.userId.toString() === userId);
  if (!member) return { allowed: false, project };

  const allowed = isRoleSufficient(member.role, minRole);
  return { allowed, project, userRole: member.role };
}
