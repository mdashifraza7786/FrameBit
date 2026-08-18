import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'owner' | 'editor' | 'reviewer';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  avatar?: string;
  role: UserRole;
  googleAccountId?: string;
  googleTokens?: {
    accessToken?: string; // encrypted
    refreshToken?: string; // encrypted
    expiryDate?: number;
    scope?: string;
    tokenType?: string;
  };
  googleDriveRootFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String },
    avatar: { type: String },
    role: {
      type: String,
      enum: ['owner', 'editor', 'reviewer'],
      default: 'editor',
    },
    googleAccountId: { type: String },
    googleTokens: {
      accessToken: { type: String },
      refreshToken: { type: String },
      expiryDate: { type: Number },
      scope: { type: String },
      tokenType: { type: String },
    },
    googleDriveRootFolderId: { type: String },
  },
  { timestamps: true }
);

// Prevent recompilation of model during hot reloading
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
