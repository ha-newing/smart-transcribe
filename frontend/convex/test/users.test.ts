import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { USER_ROLES } from "../../src/constants/enums";
import { setupConvexTest, createTestUser } from "./helpers";

describe("Users and Authentication", () => {
  let t: Awaited<ReturnType<typeof setupConvexTest>>;

  beforeEach(async () => {
    t = setupConvexTest();
  });

  describe("current user query", () => {
    it("should return current user for authenticated user", async () => {
      const { userId, identity, email, companyId } = await createTestUser(t, {
        email: "test@example.com",
        name: "Test User",
      });

      const currentUser = await identity.query(api.users.current, {});

      expect(currentUser).toBeDefined();
      expect(currentUser?._id).toBe(userId);
      expect(currentUser?.email).toBe(email);
      expect(currentUser?.name).toBe("Test User");
      expect(currentUser?.companyId).toBe(companyId);
    });

    it("should return null for unauthenticated user", async () => {
      const currentUser = await t.query(api.users.current, {});
      expect(currentUser).toBeNull();
    });
  });

  describe("company auto-creation", () => {
    it("should create company from email domain", async () => {
      const { companyId } = await createTestUser(t, {
        email: "user@newcompany.com",
      });

      const company = await t.run(async (ctx) => ctx.db.get(companyId));

      expect(company).toBeDefined();
      expect(company?.domain).toBe("newcompany.com");
      expect(company?.name).toBe("Newcompany"); // Capitalized
    });

    it("should reuse existing company for same domain", async () => {
      const { companyId: company1 } = await createTestUser(t, {
        email: "user1@samecompany.com",
      });

      const { companyId: company2 } = await createTestUser(t, {
        email: "user2@samecompany.com",
      });

      expect(company1).toBe(company2);
    });
  });

  describe("user roles", () => {
    it("should assign Admin role to first user in company", async () => {
      const { userId } = await createTestUser(t, {
        email: "first@newco.com",
      });

      const user = await t.run(async (ctx) => ctx.db.get(userId));
      expect(user?.role).toBe(USER_ROLES.ADMIN);
    });

    it("should assign Viewer role to subsequent users", async () => {
      const { companyId } = await createTestUser(t, {
        email: "admin@company.com",
      });

      const { userId: secondUserId } = await createTestUser(t, {
        email: "viewer@company.com",
        companyId,
      });

      const secondUser = await t.run(async (ctx) => ctx.db.get(secondUserId));
      expect(secondUser?.role).toBe(USER_ROLES.VIEWER);
    });
  });

  describe("listByCompany", () => {
    it("should list all users in company for authenticated user", async () => {
      const { companyId, identity } = await createTestUser(t, {
        email: "user1@company.com",
        name: "User One",
      });

      await createTestUser(t, {
        email: "user2@company.com",
        name: "User Two",
        companyId,
      });

      await createTestUser(t, {
        email: "user3@company.com",
        name: "User Three",
        companyId,
      });

      const users = await identity.query(api.users.listByCompany, {});

      expect(users).toHaveLength(3);
      expect(users.map((u) => u.name)).toContain("User One");
      expect(users.map((u) => u.name)).toContain("User Two");
      expect(users.map((u) => u.name)).toContain("User Three");
    });

    it("should only show users from same company", async () => {
      const { identity: company1Identity } = await createTestUser(t, {
        email: "user@company1.com",
      });

      await createTestUser(t, {
        email: "user@company2.com",
      });

      const users = await company1Identity.query(api.users.listByCompany, {});

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe("user@company1.com");
    });

    it("should fail for unauthenticated user", async () => {
      await expect(t.query(api.users.listByCompany, {})).rejects.toThrow(
        "Not authenticated"
      );
    });
  });

  describe("updateRole (admin only)", () => {
    it("should allow admin to update user role", async () => {
      const { companyId, identity: adminIdentity } = await createTestUser(t, {
        email: "admin@company.com",
        role: USER_ROLES.ADMIN,
      });

      const { userId: viewerId } = await createTestUser(t, {
        email: "viewer@company.com",
        companyId,
        role: USER_ROLES.VIEWER,
      });

      await adminIdentity.mutation(api.users.updateRole, {
        userId: viewerId,
        role: USER_ROLES.EDITOR,
      });

      const viewer = await t.run(async (ctx) => ctx.db.get(viewerId));
      expect(viewer?.role).toBe(USER_ROLES.EDITOR);
    });

    it("should fail for non-admin user", async () => {
      const { companyId } = await createTestUser(t, {
        email: "admin@company.com",
        role: USER_ROLES.ADMIN,
      });

      const { userId: editorId, identity: editorIdentity } =
        await createTestUser(t, {
          email: "editor@company.com",
          companyId,
          role: USER_ROLES.EDITOR,
        });

      const { userId: viewerId } = await createTestUser(t, {
        email: "viewer@company.com",
        companyId,
        role: USER_ROLES.VIEWER,
      });

      await expect(
        editorIdentity.mutation(api.users.updateRole, {
          userId: viewerId,
          role: USER_ROLES.EDITOR,
        })
      ).rejects.toThrow("Only admins can update user roles");
    });

    it("should fail when updating user from different company", async () => {
      const { identity: admin1Identity } = await createTestUser(t, {
        email: "admin@company1.com",
        role: USER_ROLES.ADMIN,
      });

      const { userId: user2Id } = await createTestUser(t, {
        email: "user@company2.com",
      });

      await expect(
        admin1Identity.mutation(api.users.updateRole, {
          userId: user2Id,
          role: USER_ROLES.EDITOR,
        })
      ).rejects.toThrow("User not found in your company");
    });
  });

  describe("remove (admin only)", () => {
    it("should allow admin to remove user from company", async () => {
      const { companyId, identity: adminIdentity } = await createTestUser(t, {
        email: "admin@company.com",
        role: USER_ROLES.ADMIN,
      });

      const { userId: viewerId } = await createTestUser(t, {
        email: "viewer@company.com",
        companyId,
        role: USER_ROLES.VIEWER,
      });

      await adminIdentity.mutation(api.users.remove, { userId: viewerId });

      const viewer = await t.run(async (ctx) => ctx.db.get(viewerId));
      expect(viewer).toBeNull();
    });

    it("should fail for non-admin user", async () => {
      const { companyId } = await createTestUser(t, {
        email: "admin@company.com",
        role: USER_ROLES.ADMIN,
      });

      const { identity: editorIdentity } = await createTestUser(t, {
        email: "editor@company.com",
        companyId,
        role: USER_ROLES.EDITOR,
      });

      const { userId: viewerId } = await createTestUser(t, {
        email: "viewer@company.com",
        companyId,
        role: USER_ROLES.VIEWER,
      });

      await expect(
        editorIdentity.mutation(api.users.remove, { userId: viewerId })
      ).rejects.toThrow("Only admins can remove users");
    });
  });
});
