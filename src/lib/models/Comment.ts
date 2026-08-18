import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IComment extends Document {
  projectId: Types.ObjectId;
  assetId: Types.ObjectId;
  versionNumber: number;
  userId?: Types.ObjectId;
  guestName?: string;
  text: string;
  timestamp: number; // in seconds (float, e.g., 42.500)
  timestampEnd?: number; // optional end time for range-based comments
  frameNumber?: number;
  x?: number; // 0-100% position on video frame
  y?: number; // 0-100% position on video frame
  drawingData?: string;
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
    timestampEnd: { type: Number },
    frameNumber: { type: Number },
    x: { type: Number },
    y: { type: Number },
    drawingData: { type: String },
    parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true, strict: false }
);

CommentSchema.index({ assetId: 1, versionNumber: 1, timestamp: 1 });

if (mongoose.models && mongoose.models.Comment) {
  delete (mongoose.models as any).Comment;
}

export const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

