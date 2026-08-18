export type UserRole = 'owner' | 'editor' | 'reviewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  googleAccountId?: string;
  googleDriveConnected: boolean;
  googleDriveRootFolderId?: string;
}

export type ReviewStatus = 'Draft' | 'In Review' | 'Changes Requested' | 'Approved' | 'Updated';

export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  owner: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  driveFolderId?: string;
  members: Array<{
    userId: {
      _id: string;
      name: string;
      email: string;
      avatar?: string;
    };
    role: UserRole;
    joinedAt: string;
  }>;
  userRole?: UserRole;
  videoCount?: number;
  membersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoVersionData {
  _id: string;
  assetId: string;
  projectId: string;
  versionNumber: number;
  driveFileId: string;
  driveFolderId?: string;
  filename: string;
  mimeType: string;
  size: number;
  duration: number;
  thumbnailUrl?: string;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  uploadStatus: 'pending' | 'completed' | 'failed';
  changeNotes?: string;
  createdAt: string;
}

export interface VideoAssetData {
  _id: string;
  projectId: string;
  name: string;
  currentVersionNumber: number;
  driveFolderId?: string;
  thumbnailUrl?: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CommentData {
  _id: string;
  projectId: string;
  assetId: string;
  versionNumber: number;
  userId?: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    role?: UserRole;
  };
  guestName?: string;
  text: string;
  timestamp: number; // seconds
  timestampEnd?: number; // optional end time for range-based comments
  frameNumber?: number;
  x?: number; // 0-100% position on video frame
  y?: number; // 0-100% position on video frame
  drawingData?: string;
  parentCommentId?: string | null;
  resolved: boolean;
  resolvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationData {
  _id: string;
  userId: string;
  actorId?: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  type: string;
  projectId?: {
    _id: string;
    name: string;
  };
  assetId?: {
    _id: string;
    name: string;
  };
  commentId?: string;
  message: string;
  read: boolean;
  createdAt: string;
}
