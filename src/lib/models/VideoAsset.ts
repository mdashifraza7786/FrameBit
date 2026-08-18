import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ReviewStatus = 'Draft' | 'In Review' | 'Changes Requested' | 'Approved' | 'Updated';

export interface IVideoAsset extends Document {
  projectId: Types.ObjectId;
  name: string;
  currentVersionNumber: number;
  driveFolderId?: string;
  thumbnailUrl?: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

const VideoAssetSchema = new Schema<IVideoAsset>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    currentVersionNumber: { type: Number, default: 1 },
    driveFolderId: { type: String },
    thumbnailUrl: { type: String },
    status: {
      type: String,
      enum: ['Draft', 'In Review', 'Changes Requested', 'Approved', 'Updated'],
      default: 'Draft',
    },
  },
  { timestamps: true }
);

VideoAssetSchema.index({ projectId: 1, createdAt: -1 });

if (mongoose.models && mongoose.models.VideoAsset) {
  delete (mongoose.models as any).VideoAsset;
}

export const VideoAsset: Model<IVideoAsset> = mongoose.model<IVideoAsset>('VideoAsset', VideoAssetSchema);
