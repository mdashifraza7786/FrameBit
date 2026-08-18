import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Notification } from '@/lib/models';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const notifications = await Notification.find({ userId: user._id })
      .populate('actorId', 'name email avatar')
      .populate('projectId', 'name')
      .populate('assetId', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: user._id,
      read: false,
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { notificationId, markAll } = await req.json();

    if (markAll) {
      await Notification.updateMany({ userId: user._id, read: false }, { $set: { read: true } });
    } else if (notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId: user._id },
        { $set: { read: true } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
