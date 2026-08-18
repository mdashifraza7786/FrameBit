import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User, Notification } from '@/lib/models';
import { getSessionUser, verifyProjectAccess } from '@/lib/auth';
import { emitRealtimeEvent } from '@/lib/events';

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

    const { allowed, project } = await verifyProjectAccess(id, user._id.toString(), 'owner');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Only the project owner can invite members' }, { status: 403 });
    }

    const { email, role } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectDB();
    let targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    const assignedRole = ['editor', 'reviewer'].includes(role) ? role : 'reviewer';

    if (!targetUser) {
      // Auto-provision user account with default credentials so team member can log in
      const defaultHash = await bcrypt.hash('welcome123', 10);
      const memberName = email.split('@')[0].replace(/[._-]/g, ' ');
      targetUser = await User.create({
        name: memberName.charAt(0).toUpperCase() + memberName.slice(1),
        email: email.toLowerCase().trim(),
        passwordHash: defaultHash,
        role: assignedRole,
      });
    }

    if (targetUser._id.toString() === project.ownerId.toString()) {
      return NextResponse.json({ error: 'User is already the owner of this project' }, { status: 400 });
    }

    const existingMember = project.members.find((m) => m.userId.toString() === targetUser._id.toString());

    if (existingMember) {
      existingMember.role = assignedRole;
    } else {
      project.members.push({
        userId: targetUser._id,
        role: assignedRole,
        joinedAt: new Date(),
      });
    }

    await project.save();

    // Create Notification for the invited user
    await Notification.create({
      userId: targetUser._id,
      actorId: user._id,
      type: 'member_added',
      projectId: project._id,
      message: `${user.name} added you as a ${assignedRole} to project "${project.name}"`,
    });

    emitRealtimeEvent({
      type: 'notification:created',
      projectId: project._id.toString(),
      data: { message: `Added to project ${project.name}` },
      actorId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    await project.populate('members.userId', 'name email avatar');

    return NextResponse.json({ members: project.members });
  } catch (error: any) {
    console.error('Member invite error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, project } = await verifyProjectAccess(id, user._id.toString(), 'owner');
    if (!allowed || !project) {
      return NextResponse.json({ error: 'Only the project owner can remove members' }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    project.members = project.members.filter((m) => m.userId.toString() !== userId) as any;
    await project.save();

    return NextResponse.json({ success: true, members: project.members });
  } catch (error: any) {
    console.error('Member removal error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
