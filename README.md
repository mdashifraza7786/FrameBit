# FrameBit — Private Video Review & Collaboration Platform

> A high-precision private video review and collaboration platform similar to **Frame.io**, using **Google Drive** as the primary direct video storage backend and **MongoDB** for real-time application metadata.

---

## 🚀 Core Philosophy: Zero Server Video Storage
 
The application **never stores video files on the application server disk or in database binaries**.

1. **Google Drive Backend**: When an editor or owner uploads a video, the application backend initiates a Google Drive resumable upload session. The browser uploads video chunks directly to Google Drive via the resumable URI.
2. **MongoDB Database**: MongoDB stores only metadata, Google Drive file IDs, project hierarchies, user roles, versions, timecoded comments, timestamps, frames, and review statuses.
3. **Pluggable Storage Abstraction**: All storage interactions implement the `StorageProvider` interface (`GoogleDriveStorageProvider` + `LocalStorageProvider` fallback), making it trivial to add S3, Backblaze B2, or Cloudflare R2 without rewriting application logic.
4. **Secure Range Streaming**: The video streaming endpoint proxies video chunks with standard HTTP 206 Partial Content (Range headers) directly from the Google Drive API after verifying user permissions and project membership.

---

## ✨ Features

- **🔐 User Roles & Permissions**:
  - **Owner / Admin**: Full project control, member invites, version management, review approval, project deletion.
  - **Editor**: Upload video cuts, add versions, manage comments, resolve feedback.
  - **Reviewer**: High-precision playback, timecoded comments, approve/request changes.
- **📁 Google Drive Auto-Organization**:
  - Dedicated root folder: `FrameBit/`
  - Automatic project subfolders: `FrameBit/<Project Name>/`
- **🎥 High-Precision Video Player**:
  - Frame stepping forward/backward (`< 1 Frame`, `1 Frame >`, or Left/Right arrow keys).
  - SMPTE standard timecode display (`HH:MM:SS:FF` at 24/30/60 fps) and millisecond precision.
  - Playback speeds (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
  - Full keyboard shortcuts: Space (Play/Pause), J/K/L (Shuttle), C (Comment at timecode), F (Fullscreen), M (Mute).
- **💬 Timecoded Comments & Threads**:
  - Sub-second timestamped comments with clickable timeline markers.
  - Hover previews over timeline comment dots showing author and feedback text.
  - Threaded replies, comment editing, deletion, and resolve/reopen status.
- **📦 Video Versioning & Asset Lifecycle**:
  - Group multiple cuts (`v1`, `v2`, `v3`) under one logical video asset.
  - Version-specific comment isolation.
  - Review status workflow: `Draft` ➔ `In Review` ➔ `Changes Requested` / `Approved` (with confetti celebration).
- **🔗 Secure Client Review Links**:
  - Generate tokenized review links (`/review/<secure-token>`) for external clients without forcing account creation.
  - Configurable permissions (`allowComments`, `allowDownloads`, `expiresInDays`).
- **⚡ Real-Time Collaboration (SSE)**:
  - Server-Sent Events hub broadcasting new comments, status changes, and notifications instantly.
- **🔍 Global Search (`⌘K`)**:
  - Instant indexed search across projects, video filenames, and comment text.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Canvas Confetti.
- **Backend**: Next.js Server Endpoints, Node.js Streams, Server-Sent Events (SSE).
- **Database**: MongoDB with Mongoose ODM.
- **Storage**: Google Drive API (v3) via `googleapis` with AES-256-GCM token encryption.

---

## 📋 Getting Started

### 1. Clone & Install Dependencies

```bash
cd frame
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your `.env.local`:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/framereview

# Authentication & Security
JWT_SECRET=super-secret-jwt-key-replace-in-production-min-32-chars
ENCRYPTION_SECRET=frame-app-aes-256-gcm-secret-key-32chars!!
APP_URL=http://localhost:3000

# Google OAuth 2.0 (for live Google Drive integration)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Storage Mode: "google-drive" or "local" (for offline/local development)
STORAGE_PROVIDER=google-drive
```

---

## 🔑 Google Cloud OAuth 2.0 Setup Guide

To connect live Google Drive accounts:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Frame-Drive-Review`).
3. Enable the **Google Drive API**:
   - Navigate to **APIs & Services > Library**.
   - Search for **Google Drive API** and click **Enable**.
4. Configure the **OAuth Consent Screen**:
   - User Type: **External** (or Internal for Google Workspace orgs).
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.file` (Per-file access created by the app)
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Add test users (your Google account email) while in testing mode.
5. Create **OAuth 2.0 Client ID**:
   - Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Copy the generated **Client ID** and **Client Secret** into your `.env.local`.

---

## 🧪 Seed Demo Data

Run the database seed script to populate realistic team accounts, sample projects, video cuts with timecode test signals, and threaded comments:

```bash
npm run seed
```

### Demo Accounts:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `owner@frame.drive` | `password123` | Full workspace control, project management |
| **Editor** | `editor@frame.drive` | `password123` | Upload cuts, add versions, resolve comments |
| **Reviewer** | `reviewer@frame.drive` | `password123` | Timecoded comments, review status approval |

*(1-click demo login buttons are also available directly on the login page!)*

---

## 🏃 Running the Application

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Production Build

```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
frame/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # Login, register, session, Google OAuth flow
│   │   │   ├── projects/      # Project CRUD, members, resumable upload sessions
│   │   │   ├── videos/        # Video details, HTTP 206 streaming proxy, comments, share
│   │   │   ├── comments/      # Comment update, resolve/reopen, delete
│   │   │   ├── review/        # Public guest review token validator
│   │   │   ├── realtime/      # Server-Sent Events (SSE) stream
│   │   │   └── search/        # Global search API
│   │   ├── dashboard/         # Metrics overview & review queue
│   │   ├── projects/          # Project list & video asset gallery
│   │   ├── review/[token]/    # Guest review portal
│   │   ├── settings/          # Google Drive OAuth connect & profile
│   │   ├── login/             # Auth login & register
│   │   └── layout.tsx         # Root layout with theme & AuthProvider
│   ├── components/
│   │   ├── common/            # GlobalSearchModal, NotificationDrawer
│   │   ├── layout/            # AppLayout sidebar & navigation
│   │   └── video/             # VideoPlayer, CommentSidebar, UploadModal, ShareModal, StatusBadge
│   ├── context/               # AuthContext session provider
│   ├── lib/
│   │   ├── crypto.ts          # AES-256-GCM token encryption
│   │   ├── db.ts              # Mongoose connection pooling
│   │   ├── events.ts          # Realtime SSE event bus
│   │   ├── models/            # User, Project, VideoAsset, VideoVersion, Comment, ShareLink, Notification
│   │   ├── storage/           # StorageProvider interface, GoogleDrive & Local providers
│   │   └── timecode.ts        # SMPTE timecode & duration utilities
│   └── scripts/
│       └── seed.ts            # Database & test media seeder
├── .env.example
├── README.md
└── package.json
```
