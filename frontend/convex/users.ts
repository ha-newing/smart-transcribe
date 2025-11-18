import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { USER_ROLES } from "../src/constants/enums";

/**
 * Get current authenticated user
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return user;
  },
});

/**
 * Get or create company from email domain
 * First user from a domain becomes the ADMIN
 */
export const getOrCreateCompany = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const domain = args.email.split("@")[1];
    if (!domain) {
      throw new Error("Invalid email format");
    }

    // Check if company exists
    const existingCompany = await ctx.db
      .query("companies")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    if (existingCompany) {
      return existingCompany;
    }

    // Create new company
    const companyName = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
    const companyId = await ctx.db.insert("companies", {
      name: companyName,
      domain,
    });

    return await ctx.db.get(companyId);
  },
});

/**
 * Update user after authentication
 * This runs after Convex Auth creates the user
 * Sets up company and role
 */
export const updateUserAfterAuth = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Skip if already set up
    if (user.companyId && user.role) {
      return user;
    }

    // Get or create company
    const domain = args.email.split("@")[1];
    if (!domain) {
      throw new Error("Invalid email format");
    }

    let company = await ctx.db
      .query("companies")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    if (!company) {
      const companyName = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
      const companyId = await ctx.db.insert("companies", {
        name: companyName,
        domain,
      });
      company = await ctx.db.get(companyId);
    }

    // Check if this is the first user in the company
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", company!._id))
      .collect();

    const isFirstUser = existingUsers.length === 0;
    const role = isFirstUser ? USER_ROLES.ADMIN : USER_ROLES.VIEWER;

    // Update user
    await ctx.db.patch(args.userId, {
      companyId: company._id,
      role,
      email: args.email,
    });

    return await ctx.db.get(args.userId);
  },
});

/**
 * List all users in current user's company
 * Only ADMIN can view this
 */
export const listCompanyUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const currentUser = await ctx.db.get(userId);
    if (!currentUser || !currentUser.companyId) {
      throw new Error("User not properly set up");
    }

    if (currentUser.role !== USER_ROLES.ADMIN) {
      throw new Error("Only admins can view users");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", currentUser.companyId))
      .collect();

    return users;
  },
});

/**
 * Update user role
 * Only ADMIN can update roles
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const currentUser = await ctx.db.get(currentUserId);
    if (!currentUser || currentUser.role !== USER_ROLES.ADMIN) {
      throw new Error("Only admins can update roles");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.companyId !== currentUser.companyId) {
      throw new Error("Cannot update users from other companies");
    }

    // Validate role
    if (!Object.values(USER_ROLES).includes(args.role as any)) {
      throw new Error("Invalid role");
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
    });

    return await ctx.db.get(args.userId);
  },
});
