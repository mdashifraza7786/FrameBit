import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { UserRole } from './User';

export interface IProjectMember {
  userId: Types.ObjectId;
  role: UserRole;
  joinedAt: Date;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  ownerId: Types.ObjectId;
  driveFolderId?: string;
  members: IProjectMember[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectMemberSchema = new Schema<IProjectMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['owner', 'editor', 'reviewer'],
      default: 'reviewer',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driveFolderId: { type: String },
    members: [ProjectMemberSchema],
  },
  { timestamps: true }
);

ProjectSchema.index({ 'members.userId': 1 });

export const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
