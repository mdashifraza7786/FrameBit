import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { User, Project, VideoAsset, VideoVersion, Comment, Notification } from '../lib/models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/framereview';
const STORAGE_ROOT = path.join(process.cwd(), '.storage_local');

async function seed() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }

  // Clear existing data
  await User.deleteMany({});
  await Project.deleteMany({});
  await VideoAsset.deleteMany({});
  await VideoVersion.deleteMany({});
  await Comment.deleteMany({});
  await Notification.deleteMany({});

  console.log('Cleared existing collections.');

  // Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const owner = await User.create({
    name: 'Sarah Chen',
    email: 'owner@frame.drive',
    passwordHash,
    role: 'owner',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    googleAccountId: 'sarah.chen@gmail.com',
    googleDriveRootFolderId: 'gdrive_root_folder_001',
  });

  const editor = await User.create({
    name: 'Marcus Vance',
    email: 'editor@frame.drive',
    passwordHash,
    role: 'editor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  });

  const reviewer = await User.create({
    name: 'Elena Rostova',
    email: 'reviewer@frame.drive',
    passwordHash,
    role: 'reviewer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  });

  console.log('Created Users: owner@frame.drive, editor@frame.drive, reviewer@frame.drive');

  // Generate Sample Video files with ffmpeg
  const sampleVideoId1 = 'seed_sample_brand_v1';
  const sampleVideoId2 = 'seed_sample_brand_v2';
  const sampleVideoId3 = 'seed_sample_product_v1';

  try {
    const videoFile1 = path.join(STORAGE_ROOT, `${sampleVideoId1}.bin`);
    const videoFile2 = path.join(STORAGE_ROOT, `${sampleVideoId2}.bin`);
    const videoFile3 = path.join(STORAGE_ROOT, `${sampleVideoId3}.bin`);

    console.log('Generating sample test videos via ffmpeg...');
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=duration=15:size=1280x720:rate=30 -pix_fmt yuv420p -c:v libx264 -movflags +faststart -f mp4 "${videoFile1}"`,
      { stdio: 'ignore' }
    );
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=duration=20:size=1280x720:rate=30 -pix_fmt yuv420p -c:v libx264 -movflags +faststart -f mp4 "${videoFile2}"`,
      { stdio: 'ignore' }
    );
    execSync(
      `ffmpeg -y -f lavfi -i testsrc2=duration=10:size=1280x720:rate=30 -pix_fmt yuv420p -c:v libx264 -movflags +faststart -f mp4 "${videoFile3}"`,
      { stdio: 'ignore' }
    );
    console.log('Generated test MP4 videos.');

    // Write metadata files for LocalStorageProvider
    const createMeta = (id: string, name: string, size: number) => {
      fs.writeFileSync(
        path.join(STORAGE_ROOT, `${id}.meta.json`),
        JSON.stringify({
          id,
          name,
          mimeType: 'video/mp4',
          size,
          createdAt: new Date().toISOString(),
        })
      );
    };

    const stat1 = fs.statSync(videoFile1);
    const stat2 = fs.statSync(videoFile2);
    const stat3 = fs.statSync(videoFile3);

    createMeta(sampleVideoId1, 'Brand_Campaign_2026_v1.mp4', stat1.size);
    createMeta(sampleVideoId2, 'Brand_Campaign_2026_v2.mp4', stat2.size);
    createMeta(sampleVideoId3, 'Product_Teaser_v1.mp4', stat3.size);
  } catch (err: any) {
    console.warn('Could not generate sample ffmpeg videos (fallback placeholder created):', err.message);
  }

  // Create Projects
  const project1 = await Project.create({
    name: 'Brand Campaign 2026',
    description: 'Master commercial cut for Q3 global digital ad launch and social assets.',
    ownerId: owner._id,
    driveFolderId: 'gdrive_folder_proj_1',
    members: [
      { userId: editor._id, role: 'editor', joinedAt: new Date() },
      { userId: reviewer._id, role: 'reviewer', joinedAt: new Date() },
    ],
  });

  const project2 = await Project.create({
    name: 'Product Launch & Features',
    description: 'Hardware overview, software walkthrough, and feature highlights.',
    ownerId: owner._id,
    driveFolderId: 'gdrive_folder_proj_2',
    members: [
      { userId: editor._id, role: 'editor', joinedAt: new Date() },
      { userId: reviewer._id, role: 'reviewer', joinedAt: new Date() },
    ],
  });

  console.log('Created Projects:', project1.name, ',', project2.name);

  // Create Video Asset with 2 versions
  const asset1 = await VideoAsset.create({
    projectId: project1._id,
    name: 'Brand Hero Video 60s',
    currentVersionNumber: 2,
    driveFolderId: project1.driveFolderId,
    status: 'In Review',
  });

  const version1 = await VideoVersion.create({
    assetId: asset1._id,
    projectId: project1._id,
    versionNumber: 1,
    driveFileId: sampleVideoId1,
    filename: 'Brand_Hero_v1.mp4',
    mimeType: 'video/mp4',
    size: 2450000,
    duration: 15,
    uploadedBy: editor._id,
    uploadStatus: 'completed',
    changeNotes: 'Initial rough cut with temp music bed and color block.',
  });

  const version2 = await VideoVersion.create({
    assetId: asset1._id,
    projectId: project1._id,
    versionNumber: 2,
    driveFileId: sampleVideoId2,
    filename: 'Brand_Hero_v2.mp4',
    mimeType: 'video/mp4',
    size: 3200000,
    duration: 20,
    uploadedBy: editor._id,
    uploadStatus: 'completed',
    changeNotes: 'Adjusted color grading, refined lower thirds, added final VO track.',
  });

  // Second Video Asset
  const asset2 = await VideoAsset.create({
    projectId: project2._id,
    name: 'Product Walkthrough',
    currentVersionNumber: 1,
    driveFolderId: project2.driveFolderId,
    status: 'Approved',
  });

  await VideoVersion.create({
    assetId: asset2._id,
    projectId: project2._id,
    versionNumber: 1,
    driveFileId: sampleVideoId3,
    filename: 'Product_Teaser_v1.mp4',
    mimeType: 'video/mp4',
    size: 1800000,
    duration: 10,
    uploadedBy: editor._id,
    uploadStatus: 'completed',
    changeNotes: 'First pass client review cut.',
  });

  // Create Timecoded Comments for Asset 1 (v2)
  const comment1 = await Comment.create({
    projectId: project1._id,
    assetId: asset1._id,
    versionNumber: 2,
    userId: reviewer._id,
    text: 'Move the logo slightly to the left and fade in 2 frames earlier.',
    timestamp: 3.5,
    frameNumber: 105,
    resolved: false,
  });

  const reply1 = await Comment.create({
    projectId: project1._id,
    assetId: asset1._id,
    versionNumber: 2,
    userId: editor._id,
    text: 'Understood. Shifting alignment 20px to match title safe area.',
    timestamp: 3.5,
    frameNumber: 105,
    parentCommentId: comment1._id,
    resolved: false,
  });

  const comment2 = await Comment.create({
    projectId: project1._id,
    assetId: asset1._id,
    versionNumber: 2,
    userId: reviewer._id,
    text: 'Audio transition here is seamless. Color grade looks excellent on OLED.',
    timestamp: 8.2,
    frameNumber: 246,
    resolved: true,
    resolvedBy: owner._id,
    resolvedAt: new Date(),
  });

  const comment3 = await Comment.create({
    projectId: project1._id,
    assetId: asset1._id,
    versionNumber: 2,
    userId: owner._id,
    text: 'Please confirm rights clearance on the backing music track before final export.',
    timestamp: 12.0,
    frameNumber: 360,
    resolved: false,
  });

  // Create Notifications
  await Notification.create({
    userId: editor._id,
    actorId: reviewer._id,
    type: 'comment_added',
    projectId: project1._id,
    assetId: asset1._id,
    commentId: comment1._id,
    message: `${reviewer.name} left a timecoded comment at 00:03.5 on "${asset1.name}"`,
    read: false,
  });

  await Notification.create({
    userId: owner._id,
    actorId: editor._id,
    type: 'version_uploaded',
    projectId: project1._id,
    assetId: asset1._id,
    message: `${editor.name} uploaded version v2 of "${asset1.name}" for review`,
    read: false,
  });

  console.log('Seeding completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
