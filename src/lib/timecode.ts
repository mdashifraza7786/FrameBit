/**
 * Formats seconds into SMPTE timecode (HH:MM:SS:FF)
 */
export function formatSMPTETimecode(seconds: number, fps = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (num: number, size = 2) => String(num).padStart(size, '0');

  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * Formats seconds into clean MM:SS.ms (e.g., 01:24.500)
 */
export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num: number, size = 2) => String(num).padStart(size, '0');

  if (ms > 0) {
    return `${pad(mins)}:${pad(secs)}.${pad(Math.floor(ms / 100), 1)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats seconds into standard MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats bytes into MB / GB
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
