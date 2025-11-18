import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { auth } from "./auth";

/**
 * Create a chapter (internal - called by AI processing)
 */
export const create = internalMutation({
  args: {
    transcriptId: v.id("transcripts"),
    projectId: v.id("projects"),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    speaker: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chapters", {
      transcriptId: args.transcriptId,
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      content: args.content,
      speaker: args.speaker,
      startTime: args.startTime,
      endTime: args.endTime,
      order: args.order,
    });
  },
});

/**
 * List chapters by transcript
 */
export const listByTranscript = query({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get transcript to check access
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) {
      throw new Error("Transcript not found");
    }

    // Check project access
    const project = await ctx.db.get(transcript.projectId);
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
          q.eq("projectId", transcript.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("chapters")
      .withIndex("by_order", (q) => q.eq("transcriptId", args.transcriptId))
      .collect();
  },
});

/**
 * List chapters by project
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
      .query("chapters")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
