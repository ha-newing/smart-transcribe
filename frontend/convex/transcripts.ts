import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { auth } from "./auth";
import { TRANSCRIPTION_STATUS, CHAPTER_TYPE } from "../src/constants/enums";

/**
 * Get transcript by ID
 */
export const get = internalQuery({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transcriptId);
  },
});

/**
 * Get transcript by file ID
 */
export const getByFileId = internalQuery({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .first();
  },
});

/**
 * Get transcript for user (public query with auth)
 */
export const getTranscript = query({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) {
      return null;
    }

    // Check project access
    const project = await ctx.db.get(transcript.projectId);
    if (!project) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const hasAccess =
      project.createdBy === userId ||
      project.sharedWithOrganization ||
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", transcript.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    return transcript;
  },
});

/**
 * List transcripts by project
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check project access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const hasAccess =
      project.createdBy === userId ||
      project.sharedWithOrganization ||
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("transcripts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Create transcript from Soniox tokens
 * Based on Soniox v3 RT API response format
 */
export const createFromSoniox = internalMutation({
  args: {
    fileId: v.id("files"),
    tokens: v.array(
      v.object({
        // Required fields
        text: v.string(),

        // Timing fields (in milliseconds)
        start_ms: v.optional(v.number()),
        end_ms: v.optional(v.number()),

        // Confidence and status
        confidence: v.optional(v.number()),
        is_final: v.optional(v.boolean()),

        // Speaker diarization
        speaker: v.optional(v.string()),

        // Language identification
        language: v.optional(v.string()),

        // Translation status (null if not translating)
        translation_status: v.optional(v.union(v.string(), v.null())),

        // Audio event detection (null if not an audio event)
        is_audio_event: v.optional(v.union(v.boolean(), v.null())),
      })
    ),
    isPartial: v.boolean(),
    chunkIndex: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
    startTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Process tokens into text
    const finalTokens = args.tokens.filter((t) => t.is_final !== false);
    const rawText = finalTokens.map((t) => t.text).join("");

    // Extract speakers
    const speakers = Array.from(
      new Set(
        finalTokens
          .map((t) => t.speaker)
          .filter((s): s is string => s !== undefined)
      )
    );

    // Check if transcript already exists for this file
    const existing = await ctx.db
      .query("transcripts")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .first();

    if (existing) {
      // Update existing transcript (append if partial)
      if (args.isPartial) {
        await ctx.db.patch(existing._id, {
          rawText: existing.rawText + "\n" + rawText,
          speakers: Array.from(new Set([...(existing.speakers || []), ...speakers])),
        });
        return existing._id;
      } else {
        await ctx.db.patch(existing._id, {
          rawText,
          speakers,
        });
        return existing._id;
      }
    } else {
      // Create new transcript
      const transcriptId = await ctx.db.insert("transcripts", {
        fileId: args.fileId,
        projectId: file.projectId,
        rawText,
        status: TRANSCRIPTION_STATUS.PENDING,
        speakers,
      });

      return transcriptId;
    }
  },
});

/**
 * Update transcript status
 */
export const updateStatus = internalMutation({
  args: {
    transcriptId: v.id("transcripts"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transcriptId, {
      status: args.status,
    });
  },
});

/**
 * Update transcript with structured content
 */
export const updateStructured = internalMutation({
  args: {
    transcriptId: v.id("transcripts"),
    structuredText: v.string(),
    speakers: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transcriptId, {
      structuredText: args.structuredText,
      speakers: args.speakers,
    });
  },
});

/**
 * Combine multiple transcripts and create a new combined transcript
 */
export const combineTranscripts = mutation({
  args: {
    transcriptIds: v.array(v.id("transcripts")),
    projectId: v.id("projects"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check project access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const hasAccess =
      project.createdBy === userId ||
      project.sharedWithOrganization ||
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Get all transcripts
    const transcripts = await Promise.all(
      args.transcriptIds.map((id) => ctx.db.get(id))
    );

    // Combine raw text
    const combinedRawText = transcripts
      .filter((t) => t !== null)
      .map((t) => t!.rawText)
      .join("\n\n---\n\n");

    // Combine structured text if available
    const combinedStructuredText = transcripts
      .filter((t) => t !== null && t!.structuredText)
      .map((t) => t!.structuredText)
      .join("\n\n---\n\n");

    // Combine speakers
    const allSpeakers = transcripts
      .filter((t) => t !== null && t!.speakers)
      .flatMap((t) => t!.speakers!);
    const uniqueSpeakers = Array.from(new Set(allSpeakers));

    // Collect all file IDs
    const fileIds = transcripts
      .filter((t) => t !== null && t!.fileId)
      .map((t) => t!.fileId!);

    // Create new combined transcript
    const combinedTranscriptId = await ctx.db.insert("transcripts", {
      projectId: args.projectId,
      fileIds,
      isCombined: true,
      title: args.title || "Combined Transcript",
      rawText: combinedRawText,
      structuredText: combinedStructuredText || undefined,
      speakers: uniqueSpeakers,
      status: combinedStructuredText ? TRANSCRIPTION_STATUS.COMPLETED : TRANSCRIPTION_STATUS.PENDING,
    });

    return combinedTranscriptId;
  },
});
