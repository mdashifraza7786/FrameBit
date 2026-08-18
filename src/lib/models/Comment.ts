import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IComment extends Document {
  projectId: Types.ObjectId;
  assetId: Types.ObjectId;
  versionNumber: number;
  userId?: Types.ObjectId;
  guestName?: string;
  text: string;
  timestamp: number; // in seconds (float, e.g., 42.500)
  frameNumber?: number;
  parentCommentId?: Types.ObjectId;
  resolved: boolean;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'VideoAsset', required: true, index: true },
    versionNumber: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestName: { type: String },
    text: { type: String, required: true, trim: true },
    timestamp: { type: Number, required: true, default: 0, index: true },
    frameNumber: { type: Number },
    parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

CommentSchema.index({ assetId: 1, versionNumber: 1, timestamp: 1 });

export const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
