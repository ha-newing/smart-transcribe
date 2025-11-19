import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { FILE_STATUS } from "../../src/constants/enums";
import {
  setupConvexTest,
  createTestUser,
  createTestProject,
  createTestFile,
} from "./helpers";

describe("Files API", () => {
  let t: Awaited<ReturnType<typeof setupConvexTest>>;

  beforeEach(async () => {
    t = setupConvexTest();
  });

  describe("generateUploadUrl", () => {
    it("should generate upload URL for authenticated user", async () => {
      const { identity } = await createTestUser(t);

      const url = await identity.mutation(api.files.generateUploadUrl, {});
      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
    });

    it("should fail for unauthenticated user", async () => {
      await expect(
        t.mutation(api.files.generateUploadUrl, {})
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("createFile", () => {
    it("should create file record for project owner", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });

      const storageId = "test-storage" as any;
      const fileId = await identity.mutation(api.files.createFile, {
        projectId,
        name: "test.mp3",
        size: 1024,
        mimeType: "audio/mpeg",
        storageId,
      });

      expect(fileId).toBeDefined();

      // Verify file was created
      const file = await t.run(async (ctx) => ctx.db.get(fileId));
      expect(file).toBeDefined();
      expect(file?.name).toBe("test.mp3");
      expect(file?.status).toBe(FILE_STATUS.UPLOADED);
      expect(file?.uploadedBy).toBe(userId);
    });

    it("should create file for shared project user", async () => {
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
        companyId,
        createdBy: owner,
        sharedWithOrganization: false,
      });

      // Share project with viewer
      await t.run(async (ctx) => {
        await ctx.db.insert("projectShares", {
          projectId,
          userId: viewer,
          sharedBy: owner,
          permission: "EDIT",
        });
      });

      const storageId = "test-storage" as any;
      const fileId = await viewerIdentity.mutation(api.files.createFile, {
        projectId,
        name: "shared-test.mp3",
        size: 2048,
        mimeType: "audio/mpeg",
        storageId,
      });

      expect(fileId).toBeDefined();
    });

    it("should fail for user without access", async () => {
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

      const storageId = "test-storage" as any;

      await expect(
        otherIdentity.mutation(api.files.createFile, {
          projectId,
          name: "unauthorized.mp3",
          size: 1024,
          mimeType: "audio/mpeg",
          storageId,
        })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("listByProject", () => {
    it("should list files for project owner", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });

      await createTestFile(t, { projectId, uploadedBy: userId, name: "file1.mp3" });
      await createTestFile(t, { projectId, uploadedBy: userId, name: "file2.mp3" });

      const files = await identity.query(api.files.listByProject, { projectId });

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name)).toContain("file1.mp3");
      expect(files.map((f) => f.name)).toContain("file2.mp3");
    });

    it("should list files for organization-shared project", async () => {
      const { userId: owner, companyId } = await createTestUser(t, {
        email: "owner@example.com",
      });
      const { identity: memberIdentity } = await createTestUser(t, {
        email: "member@example.com",
        companyId,
      });

      const projectId = await createTestProject(t, {
        companyId,
        createdBy: owner,
        sharedWithOrganization: true,
      });

      await createTestFile(t, { projectId, uploadedBy: owner, name: "shared.mp3" });

      const files = await memberIdentity.query(api.files.listByProject, {
        projectId,
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("shared.mp3");
    });

    it("should fail for user without access", async () => {
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

      await expect(
        otherIdentity.query(api.files.listByProject, { projectId })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("get", () => {
    it("should get file by ID with access", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, {
        projectId,
        uploadedBy: userId,
        name: "test-file.mp3",
      });

      const file = await identity.query(api.files.get, { fileId });

      expect(file).toBeDefined();
      expect(file?.name).toBe("test-file.mp3");
    });

    it("should return null for non-existent file", async () => {
      const { identity } = await createTestUser(t);
      const fakeId = "fake-id" as any;

      const file = await identity.query(api.files.get, { fileId: fakeId });

      expect(file).toBeNull();
    });
  });

  describe("updateStatus (internal)", () => {
    it("should update file status", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, {
        projectId,
        uploadedBy: userId,
        status: FILE_STATUS.UPLOADED,
      });

      // Use internal mutation via t.mutation (not through identity)
      await t.mutation(api.files.updateStatus, {
        fileId,
        status: FILE_STATUS.PROCESSING,
      });

      const updatedFile = await t.run(async (ctx) => ctx.db.get(fileId));
      expect(updatedFile?.status).toBe(FILE_STATUS.PROCESSING);
    });
  });
});
