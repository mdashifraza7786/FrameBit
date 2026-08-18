import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type NotificationType =
  | 'comment_added'
  | 'comment_reply'
  | 'comment_resolved'
  | 'status_changed'
  | 'version_uploaded'
  | 'member_added';

export interface INotification extends Document {
  userId: Types.ObjectId;
  actorId?: Types.ObjectId;
  type: NotificationType;
  projectId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  commentId?: Types.ObjectId;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: [
        'comment_added',
        'comment_reply',
        'comment_resolved',
        'status_changed',
        'version_uploaded',
        'member_added',
      ],
      required: true,
    },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    assetId: { type: Schema.Types.ObjectId, ref: 'VideoAsset' },
    commentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
