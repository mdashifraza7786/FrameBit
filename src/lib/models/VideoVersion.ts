import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IVideoVersion extends Document {
  assetId: Types.ObjectId;
  projectId: Types.ObjectId;
  versionNumber: number;
  driveFileId: string;
  driveFolderId?: string;
  filename: string;
  mimeType: string;
  size: number;
  duration?: number; // duration in seconds
  thumbnailUrl?: string;
  uploadedBy: Types.ObjectId;
  uploadStatus: 'pending' | 'completed' | 'failed';
  changeNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoVersionSchema = new Schema<IVideoVersion>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: 'VideoAsset', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    versionNumber: { type: Number, required: true },
    driveFileId: { type: String, required: true, index: true },
    driveFolderId: { type: String },
    filename: { type: String, required: true },
    mimeType: { type: String, default: 'video/mp4' },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    thumbnailUrl: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    changeNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

VideoVersionSchema.index({ assetId: 1, versionNumber: 1 }, { unique: true });

export const VideoVersion: Model<IVideoVersion> =
  mongoose.models.VideoVersion || mongoose.model<IVideoVersion>('VideoVersion', VideoVersionSchema);
