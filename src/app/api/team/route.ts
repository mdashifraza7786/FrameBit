import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User, Project } from '@/lib/models';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Fetch projects owned by this user
    const projects = await Project.find({ ownerId: user._id }).populate('members.userId', 'name email avatar role');

    // Aggregate unique team members
    const memberMap = new Map<string, any>();

    projects.forEach((proj) => {
      proj.members.forEach((m: any) => {
        if (m.userId && !memberMap.has(m.userId._id.toString())) {
          memberMap.set(m.userId._id.toString(), {
            id: m.userId._id.toString(),
            name: m.userId.name,
            email: m.userId.email,
            avatar: m.userId.avatar,
            role: m.role,
            joinedAt: m.joinedAt,
            projectCount: 1,
          });
        } else if (m.userId) {
          const existing = memberMap.get(m.userId._id.toString());
          existing.projectCount += 1;
        }
      });
    });

    return NextResponse.json({ members: Array.from(memberMap.values()) });
  } catch (error: any) {
    console.error('Team GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'owner') {
      return NextResponse.json({ error: 'Only workspace owners can add team members' }, { status: 403 });
    }

    const { email, name, role = 'reviewer', projectId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectDB();

    let targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    const assignedRole = ['editor', 'reviewer'].includes(role) ? role : 'reviewer';

    if (!targetUser) {
      const defaultHash = await bcrypt.hash('welcome123', 10);
      const cleanName = name?.trim() || email.split('@')[0].replace(/[._-]/g, ' ');
      targetUser = await User.create({
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        email: email.toLowerCase().trim(),
        passwordHash: defaultHash,
        role: assignedRole,
      });
    }

    // If projectId specified, add them to that project
    if (projectId) {
      const project = await Project.findOne({ _id: projectId, ownerId: user._id });
      if (project) {
        const exists = project.members.some((m) => m.userId.toString() === targetUser._id.toString());
        if (!exists) {
          project.members.push({
            userId: targetUser._id,
            role: assignedRole,
            joinedAt: new Date(),
          });
          await project.save();
        }
      }
    } else {
      // Add to all projects owned by this user
      const projects = await Project.find({ ownerId: user._id });
      for (const p of projects) {
        const exists = p.members.some((m) => m.userId.toString() === targetUser._id.toString());
        if (!exists) {
          p.members.push({
            userId: targetUser._id,
            role: assignedRole,
            joinedAt: new Date(),
          });
          await p.save();
        }
      }
    }

    return NextResponse.json({
      success: true,
      member: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: assignedRole,
      },
    });
  } catch (error: any) {
    console.error('Team POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
