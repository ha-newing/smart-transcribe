/**
 * Test helpers and utilities for Convex tests
 */

import { convexTest } from "convex-test";
import { expect } from "vitest";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";
import { USER_ROLES, PROJECT_STATUS, FILE_STATUS, TRANSCRIPTION_STATUS } from "../../src/constants/enums";

/**
 * Create test environment with schema
 * The modules parameter uses import.meta.glob to include all convex files
 */
export const setupConvexTest = () => {
  // Use import.meta.glob to include convex modules, excluding tests
  const modules = import.meta.glob(["../**/*.{ts,js}", "!../**/*.test.{ts,js}", "!../test/**"], { eager: true });
  return convexTest(schema, modules);
};

/**
 * Create a test user with auth identity
 * Note: Convex Auth uses subject format "userId|sessionId"
 */
export async function createTestUser(
  t: Awaited<ReturnType<typeof setupConvexTest>>,
  options: {
    email?: string;
    name?: string;
    role?: string;
    companyId?: Id<"companies">;
  } = {}
) {
  const email = options.email || "test@example.com";
  const name = options.name || "Test User";

  // Create company if not provided
  let companyId = options.companyId;
  if (!companyId) {
    const domain = email.split("@")[1];
    companyId = await t.run(async (ctx) => {
      return await ctx.db.insert("companies", {
        name: domain.split(".")[0],
        domain,
      });
    });
  }

  // Create user
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email,
      name,
      role: options.role || USER_ROLES.ADMIN,
      companyId,
      emailVerificationTime: Date.now(),
    });
  });

  // Create auth identity with subject format "userId|sessionId"
  const identity = t.withIdentity({
    subject: `${userId}|test-session`,
    email,
    name,
  });

  return { userId, companyId, identity, email, name };
}

/**
 * Create a test project
 */
export async function createTestProject(
  t: Awaited<ReturnType<typeof setupConvexTest>>,
  options: {
    name?: string;
    description?: string;
    companyId: Id<"companies">;
    createdBy: Id<"users">;
    status?: string;
    sharedWithOrganization?: boolean;
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      name: options.name || "Test Project",
      description: options.description || "Test Description",
      status: options.status || PROJECT_STATUS.ACTIVE,
      companyId: options.companyId,
      createdBy: options.createdBy,
      sharedWithOrganization: options.sharedWithOrganization ?? true,
    });
  });
}

/**
 * Create a test file
 */
export async function createTestFile(
  t: Awaited<ReturnType<typeof setupConvexTest>>,
  options: {
    projectId: Id<"projects">;
    uploadedBy: Id<"users">;
    name?: string;
    size?: number;
    mimeType?: string;
    status?: string;
    duration?: number;
  }
) {
  return await t.run(async (ctx) => {
    // Create a fake storage ID
    const storageId = "test-storage-id" as Id<"_storage">;

    return await ctx.db.insert("files", {
      projectId: options.projectId,
      uploadedBy: options.uploadedBy,
      storageId,
      name: options.name || "test-audio.mp3",
      size: options.size || 1024 * 1024 * 5, // 5MB
      mimeType: options.mimeType || "audio/mpeg",
      status: options.status || FILE_STATUS.UPLOADED,
      duration: options.duration,
    });
  });
}

/**
 * Create a test transcript
 */
export async function createTestTranscript(
  t: Awaited<ReturnType<typeof setupConvexTest>>,
  options: {
    fileId: Id<"files">;
    projectId: Id<"projects">;
    rawText?: string;
    structuredText?: string;
    status?: string;
    speakers?: string[];
    language?: string;
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("transcripts", {
      fileId: options.fileId,
      projectId: options.projectId,
      rawText: options.rawText || "This is a test transcript.",
      structuredText: options.structuredText,
      status: options.status || TRANSCRIPTION_STATUS.COMPLETED,
      speakers: options.speakers,
      language: options.language || "en",
    });
  });
}

/**
 * Create a test chapter
 */
export async function createTestChapter(
  t: Awaited<ReturnType<typeof setupConvexTest>>,
  options: {
    transcriptId: Id<"transcripts">;
    projectId: Id<"projects">;
    type: string;
    title: string;
    content: string;
    order: number;
    speaker?: string;
    startTime?: number;
    endTime?: number;
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("chapters", options);
  });
}

/**
 * Create a test embedding
 */
export async function createTestEmbedding(
  t: Awaited<ReturnType<typeof setupConvexTest>>,
  options: {
    transcriptId: Id<"transcripts">;
    projectId: Id<"projects">;
    text: string;
    embedding: number[];
    chapterId?: Id<"chapters">;
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("embeddings", {
      transcriptId: options.transcriptId,
      projectId: options.projectId,
      text: options.text,
      embedding: options.embedding,
      chapterId: options.chapterId,
    });
  });
}

/**
 * Generate a random embedding vector
 */
export function generateRandomEmbedding(dimensions: number = 768): number[] {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}

/**
 * Mock fetch for external API calls
 */
export function mockFetch(responseData: any, status: number = 200) {
  global.fetch = async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseData,
      text: async () => JSON.stringify(responseData),
    } as Response;
  };
}

/**
 * Restore original fetch
 */
export function restoreFetch() {
  // @ts-ignore
  delete global.fetch;
}

/**
 * Assert error with message
 */
export function expectError(fn: () => Promise<any>, errorMessage?: string) {
  return expect(fn()).rejects.toThrow(errorMessage);
}
