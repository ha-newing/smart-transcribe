/**
 * Enums - Single source of truth for frontend/Convex/backend
 * IMPORTANT: Always use these constants instead of string literals
 */

// User Roles
export const USER_ROLES = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Project Status
export const PROJECT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// File Status
export const FILE_STATUS = {
  UPLOADING: "UPLOADING",
  UPLOADED: "UPLOADED",
  PROCESSING: "PROCESSING",
  TRANSCRIBING: "TRANSCRIBING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

// Transcription Status
export const TRANSCRIPTION_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type TranscriptionStatus =
  (typeof TRANSCRIPTION_STATUS)[keyof typeof TRANSCRIPTION_STATUS];

// Share Permission Level
export const SHARE_PERMISSION = {
  VIEW: "VIEW",
  EDIT: "EDIT",
  ADMIN: "ADMIN",
} as const;

export type SharePermission =
  (typeof SHARE_PERMISSION)[keyof typeof SHARE_PERMISSION];

// Chapter Type
export const CHAPTER_TYPE = {
  SECTION: "SECTION",
  TOPIC: "TOPIC",
  SPEAKER_TURN: "SPEAKER_TURN",
} as const;

export type ChapterType = (typeof CHAPTER_TYPE)[keyof typeof CHAPTER_TYPE];
