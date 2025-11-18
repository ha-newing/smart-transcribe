import { Id } from "../../convex/_generated/dataModel";
import {
  UserRole,
  ProjectStatus,
  FileStatus,
  TranscriptionStatus,
  SharePermission,
  ChapterType,
} from "../constants/enums";

export interface User {
  _id: Id<"users">;
  _creationTime: number;
  email: string;
  name?: string;
  role: UserRole;
  companyId: Id<"companies">;
}

export interface Company {
  _id: Id<"companies">;
  _creationTime: number;
  name: string;
  domain: string;
}

export interface Project {
  _id: Id<"projects">;
  _creationTime: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  companyId: Id<"companies">;
  createdBy: Id<"users">;
  sharedWithOrganization: boolean;
}

export interface File {
  _id: Id<"files">;
  _creationTime: number;
  projectId: Id<"projects">;
  name: string;
  size: number;
  mimeType: string;
  storageId: Id<"_storage">;
  status: FileStatus;
  duration?: number; // in seconds
  uploadedBy: Id<"users">;
}

export interface Transcript {
  _id: Id<"transcripts">;
  _creationTime: number;
  fileId: Id<"files">;
  projectId: Id<"projects">;
  rawText: string;
  structuredText?: string;
  status: TranscriptionStatus;
  language?: string;
}

export interface Chapter {
  _id: Id<"chapters">;
  _creationTime: number;
  transcriptId: Id<"transcripts">;
  projectId: Id<"projects">;
  type: ChapterType;
  title: string;
  content: string;
  startTime?: number; // in seconds
  endTime?: number; // in seconds
  speaker?: string;
  order: number;
}

export interface ConceptNode {
  _id: Id<"concepts">;
  _creationTime: number;
  projectId: Id<"projects">;
  transcriptId: Id<"transcripts">;
  concept: string;
  description?: string;
  relatedConcepts: Id<"concepts">[];
  position: { x: number; y: number };
}

export interface ProjectShare {
  _id: Id<"projectShares">;
  _creationTime: number;
  projectId: Id<"projects">;
  userId: Id<"users">;
  permission: SharePermission;
  sharedBy: Id<"users">;
}
