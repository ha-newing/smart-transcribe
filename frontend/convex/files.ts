import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { auth } from "./auth";
import { api } from "./_generated/api";
import { FILE_STATUS } from "../src/constants/enums";

/**
 * List files in a project
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user has access to project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check access
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

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return files;
  },
});

/**
 * Generate upload URL for file
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create file record after upload
 */
export const createFile = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    size: v.number(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user can upload to this project
    const canUpload =
      project.createdBy === userId ||
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!canUpload) {
      throw new Error("Access denied");
    }

    // Get current file count for displayOrder
    const existingFiles = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const displayOrder = existingFiles.length;

    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      size: args.size,
      mimeType: args.mimeType,
      storageId: args.storageId,
      status: FILE_STATUS.UPLOADED,
      uploadedBy: userId,
      displayOrder,
    });

    // Auto-start transcription
    await ctx.scheduler.runAfter(0, api.transcription.startTranscription, {
      fileId,
    });

    return fileId;
  },
});

/**
 * Get file by ID
 */
export const get = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      return null;
    }

    // Check project access
    const project = await ctx.db.get(file.projectId);
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
          q.eq("projectId", file.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    return file;
  },
});

/**
 * Get file by ID (internal - no auth check)
 */
export const getInternal = internalQuery({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

/**
 * List files by project (internal - no auth check, ordered by displayOrder)
 */
export const listByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Sort by displayOrder, then by name as fallback
    return files.sort((a, b) => {
      const orderA = a.displayOrder ?? Number.MAX_VALUE;
      const orderB = b.displayOrder ?? Number.MAX_VALUE;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Get file download URL
 */
export const getDownloadUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Update file status (internal)
 */
export const updateStatus = internalMutation({
  args: {
    fileId: v.id("files"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      status: args.status,
    });
  },
});

/**
 * Update file display order
 */
export const updateFileOrder = mutation({
  args: {
    fileId: v.id("files"),
    newOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Check project access
    const project = await ctx.db.get(file.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const hasAccess =
      project.createdBy === userId ||
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", file.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.fileId, {
      displayOrder: args.newOrder,
    });

    return { success: true };
  },
});

/**
 * Reorder multiple files at once
 */
export const reorderFiles = mutation({
  args: {
    projectId: v.id("projects"),
    fileOrders: v.array(
      v.object({
        fileId: v.id("files"),
        order: v.number(),
      })
    ),
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
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Update all file orders
    await Promise.all(
      args.fileOrders.map(({ fileId, order }) =>
        ctx.db.patch(fileId, { displayOrder: order })
      )
    );

    return { success: true };
  },
});

/**
 * Reset file to allow re-transcription
 */
export const resetForRetranscription = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Check project access
    const project = await ctx.db.get(file.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const hasAccess =
      project.createdBy === userId ||
      (await ctx.db
        .query("projectShares")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", file.projectId).eq("userId", userId)
        )
        .first()) !== null;

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Reset file status to UPLOADED so it can be transcribed again
    await ctx.db.patch(args.fileId, {
      status: FILE_STATUS.UPLOADED,
    });

    // Reset transcript status if exists
    const transcript = await ctx.db
      .query("transcripts")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .first();

    if (transcript) {
      await ctx.db.patch(transcript._id, {
        status: "PENDING",
      });
    }

    return { success: true };
  },
});
