import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { PROJECT_STATUS, USER_ROLES, SHARE_PERMISSION } from "../src/constants/enums";

/**
 * List projects accessible by current user
 * Returns projects user created, shared with them, or shared with organization
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.companyId) {
      return [];
    }

    // Get projects created by user
    const ownProjects = await ctx.db
      .query("projects")
      .withIndex("by_creator", (q) => q.eq("createdBy", userId))
      .collect();

    // Get projects shared with organization
    const orgProjects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", user.companyId))
      .filter((q) => q.eq(q.field("sharedWithOrganization"), true))
      .collect();

    // Get projects shared with user directly
    const shares = await ctx.db
      .query("projectShares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const sharedProjectIds = shares.map((s) => s.projectId);
    const sharedProjects = await Promise.all(
      sharedProjectIds.map((id) => ctx.db.get(id))
    );

    // Combine and deduplicate
    const allProjects = [
      ...ownProjects,
      ...orgProjects,
      ...sharedProjects.filter((p) => p !== null),
    ];

    const uniqueProjects = Array.from(
      new Map(allProjects.map((p) => [p!._id, p])).values()
    );

    return uniqueProjects;
  },
});

/**
 * Get single project by ID
 */
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check access permissions
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

    return project;
  },
});

/**
 * Create new project
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sharedWithOrganization: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.companyId) {
      throw new Error("User not properly set up");
    }

    // Only ADMIN and EDITOR can create projects
    if (user.role === USER_ROLES.VIEWER) {
      throw new Error("Viewers cannot create projects");
    }

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      status: PROJECT_STATUS.DRAFT,
      companyId: user.companyId,
      createdBy: userId,
      sharedWithOrganization: args.sharedWithOrganization ?? false,
    });

    return projectId;
  },
});

/**
 * Update project
 */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    sharedWithOrganization: v.optional(v.boolean()),
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

    // Check if user has edit permissions
    const isCreator = project.createdBy === userId;
    const share = await ctx.db
      .query("projectShares")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId)
      )
      .first();

    const hasEditAccess =
      isCreator ||
      user.role === USER_ROLES.ADMIN ||
      (share && (share.permission === SHARE_PERMISSION.EDIT || share.permission === SHARE_PERMISSION.ADMIN));

    if (!hasEditAccess) {
      throw new Error("Access denied");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;
    if (args.sharedWithOrganization !== undefined)
      updates.sharedWithOrganization = args.sharedWithOrganization;

    await ctx.db.patch(args.projectId, updates);

    return await ctx.db.get(args.projectId);
  },
});

/**
 * Delete project
 */
export const remove = mutation({
  args: { projectId: v.id("projects") },
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

    // Only creator or admin can delete
    if (project.createdBy !== userId && user.role !== USER_ROLES.ADMIN) {
      throw new Error("Access denied");
    }

    // TODO: Delete related files, transcripts, etc.
    await ctx.db.delete(args.projectId);
  },
});

/**
 * Share project with user
 */
export const shareWithUser = mutation({
  args: {
    projectId: v.id("projects"),
    userEmail: v.string(),
    permission: v.string(),
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

    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Only creator or admin can share
    if (project.createdBy !== userId && currentUser.role !== USER_ROLES.ADMIN) {
      throw new Error("Access denied");
    }

    // Find user to share with
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Check if already shared
    const existingShare = await ctx.db
      .query("projectShares")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", targetUser._id)
      )
      .first();

    if (existingShare) {
      // Update permission
      await ctx.db.patch(existingShare._id, {
        permission: args.permission,
      });
      return existingShare._id;
    }

    // Create new share
    const shareId = await ctx.db.insert("projectShares", {
      projectId: args.projectId,
      userId: targetUser._id,
      permission: args.permission,
      sharedBy: userId,
    });

    return shareId;
  },
});
