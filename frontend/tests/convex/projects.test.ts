import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { PROJECT_STATUS } from "../../src/constants/enums";
import {
  setupConvexTest,
  createTestUser,
  createTestProject,
} from "./helpers";

describe("Projects API", () => {
  let t: Awaited<ReturnType<typeof setupConvexTest>>;

  beforeEach(async () => {
    t = setupConvexTest();
  });

  describe("create", () => {
    it("should create project for authenticated user", async () => {
      const { identity, companyId } = await createTestUser(t);

      const projectId = await identity.mutation(api.projects.create, {
        name: "My Project",
        description: "Test project description",
        sharedWithOrganization: true,
      });

      expect(projectId).toBeDefined();

      const project = await t.run(async (ctx) => ctx.db.get(projectId));
      expect(project).toBeDefined();
      expect(project?.name).toBe("My Project");
      expect(project?.description).toBe("Test project description");
      expect(project?.status).toBe(PROJECT_STATUS.ACTIVE);
      expect(project?.companyId).toBe(companyId);
      expect(project?.sharedWithOrganization).toBe(true);
    });

    it("should create project without description", async () => {
      const { identity } = await createTestUser(t);

      const projectId = await identity.mutation(api.projects.create, {
        name: "Simple Project",
      });

      const project = await t.run(async (ctx) => ctx.db.get(projectId));
      expect(project?.description).toBeUndefined();
    });

    it("should fail for unauthenticated user", async () => {
      await expect(
        t.mutation(api.projects.create, { name: "Test" })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("list", () => {
    it("should list user's own projects", async () => {
      const { userId, companyId, identity } = await createTestUser(t);

      await createTestProject(t, {
        name: "Project 1",
        companyId,
        createdBy: userId,
      });
      await createTestProject(t, {
        name: "Project 2",
        companyId,
        createdBy: userId,
      });

      const projects = await identity.query(api.projects.list, {});

      expect(projects).toHaveLength(2);
      expect(projects.map((p) => p.name)).toContain("Project 1");
      expect(projects.map((p) => p.name)).toContain("Project 2");
    });

    it("should list organization-shared projects", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { identity: memberIdentity } = await createTestUser(t, {
        email: "member@example.com",
        companyId,
      });

      await createTestProject(t, {
        name: "Shared Project",
        companyId,
        createdBy: owner,
        sharedWithOrganization: true,
      });

      const projects = await memberIdentity.query(api.projects.list, {});

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe("Shared Project");
    });

    it("should list user-shared projects", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { userId: viewer, identity: viewerIdentity } = await createTestUser(
        t,
        {
          email: "viewer@example.com",
          companyId,
        }
      );

      const projectId = await createTestProject(t, {
        name: "User Shared Project",
        companyId,
        createdBy: owner,
        sharedWithOrganization: false,
      });

      // Share with viewer
      await t.run(async (ctx) => {
        await ctx.db.insert("projectShares", {
          projectId,
          userId: viewer,
          sharedBy: owner,
          permission: "VIEW",
        });
      });

      const projects = await viewerIdentity.query(api.projects.list, {});

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe("User Shared Project");
    });

    it("should not list projects from other companies", async () => {
      const { userId: user1, companyId: company1 } = await createTestUser(t, {
        email: "user1@company1.com",
      });
      const { identity: user2Identity } = await createTestUser(t, {
        email: "user2@company2.com",
      });

      await createTestProject(t, {
        name: "Company 1 Project",
        companyId: company1,
        createdBy: user1,
        sharedWithOrganization: true,
      });

      const projects = await user2Identity.query(api.projects.list, {});

      expect(projects).toHaveLength(0);
    });
  });

  describe("get", () => {
    it("should get project by ID for owner", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        name: "Test Project",
        companyId,
        createdBy: userId,
      });

      const project = await identity.query(api.projects.get, { projectId });

      expect(project).toBeDefined();
      expect(project?.name).toBe("Test Project");
    });

    it("should get project for organization member", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { identity: memberIdentity } = await createTestUser(t, {
        email: "member@example.com",
        companyId,
      });

      const projectId = await createTestProject(t, {
        name: "Org Project",
        companyId,
        createdBy: owner,
        sharedWithOrganization: true,
      });

      const project = await memberIdentity.query(api.projects.get, { projectId });

      expect(project).toBeDefined();
      expect(project?.name).toBe("Org Project");
    });

    it("should return null for unauthorized user", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { identity: otherIdentity } = await createTestUser(t, {
        email: "other@different.com",
      });

      const projectId = await createTestProject(t, {
        companyId,
        createdBy: owner,
        sharedWithOrganization: false,
      });

      const project = await otherIdentity.query(api.projects.get, { projectId });

      expect(project).toBeNull();
    });
  });

  describe("update", () => {
    it("should update project for owner", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        name: "Original Name",
        companyId,
        createdBy: userId,
      });

      await identity.mutation(api.projects.update, {
        projectId,
        name: "Updated Name",
        description: "New description",
      });

      const project = await t.run(async (ctx) => ctx.db.get(projectId));
      expect(project?.name).toBe("Updated Name");
      expect(project?.description).toBe("New description");
    });

    it("should fail for non-owner", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { identity: otherIdentity } = await createTestUser(t, {
        email: "other@example.com",
        companyId,
      });

      const projectId = await createTestProject(t, {
        companyId,
        createdBy: owner,
        sharedWithOrganization: true,
      });

      await expect(
        otherIdentity.mutation(api.projects.update, {
          projectId,
          name: "Hacked Name",
        })
      ).rejects.toThrow("Only the project owner can update");
    });
  });

  describe("remove", () => {
    it("should delete project for owner", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });

      await identity.mutation(api.projects.remove, { projectId });

      const project = await t.run(async (ctx) => ctx.db.get(projectId));
      expect(project).toBeNull();
    });

    it("should fail for non-owner", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { identity: otherIdentity } = await createTestUser(t, {
        email: "other@example.com",
        companyId,
      });

      const projectId = await createTestProject(t, {
        companyId,
        createdBy: owner,
      });

      await expect(
        otherIdentity.mutation(api.projects.remove, { projectId })
      ).rejects.toThrow("Only the project owner can delete");
    });
  });

  describe("shareWithUser", () => {
    it("should share project with specific user", async () => {
      const { userId: owner, companyId, identity: ownerIdentity } =
        await createTestUser(t, { email: "owner@example.com" });
      const { userId: viewer } = await createTestUser(t, {
        email: "viewer@example.com",
        companyId,
      });

      const projectId = await createTestProject(t, {
        companyId,
        createdBy: owner,
        sharedWithOrganization: false,
      });

      await ownerIdentity.mutation(api.projects.shareWithUser, {
        projectId,
        userId: viewer,
        permission: "EDIT",
      });

      const share = await t.run(async (ctx) => {
        return await ctx.db
          .query("projectShares")
          .withIndex("by_project_and_user", (q) =>
            q.eq("projectId", projectId).eq("userId", viewer)
          )
          .first();
      });

      expect(share).toBeDefined();
      expect(share?.permission).toBe("EDIT");
      expect(share?.sharedBy).toBe(owner);
    });

    it("should fail for non-owner", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { userId: viewer, identity: viewerIdentity } = await createTestUser(
        t,
        {
          email: "viewer@example.com",
          companyId,
        }
      );
      const { userId: other } = await createTestUser(t, {
        email: "other@example.com",
        companyId,
      });

      const projectId = await createTestProject(t, {
        companyId,
        createdBy: owner,
      });

      await expect(
        viewerIdentity.mutation(api.projects.shareWithUser, {
          projectId,
          userId: other,
          permission: "VIEW",
        })
      ).rejects.toThrow("Only the project owner can share");
    });
  });
});
