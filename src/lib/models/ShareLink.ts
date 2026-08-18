import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IShareLink extends Document {
  token: string;
  projectId: Types.ObjectId;
  assetId: Types.ObjectId;
  versionNumber?: number;
  createdBy: Types.ObjectId;
  allowComments: boolean;
  allowDownloads: boolean;
  expiresAt?: Date;
  passcodeHash?: string;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>(
  {
    token: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'VideoAsset', required: true },
    versionNumber: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    allowComments: { type: Boolean, default: true },
    allowDownloads: { type: Boolean, default: false },
    expiresAt: { type: Date },
    passcodeHash: { type: String },
    viewsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ShareLink: Model<IShareLink> =
  mongoose.models.ShareLink || mongoose.model<IShareLink>('ShareLink', ShareLinkSchema);
