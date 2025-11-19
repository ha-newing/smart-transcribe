import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { CHAPTER_TYPE } from "../../src/constants/enums";
import {
  setupConvexTest,
  createTestUser,
  createTestProject,
  createTestFile,
  createTestTranscript,
  createTestChapter,
} from "./helpers";

describe("Chapters API", () => {
  let t: Awaited<ReturnType<typeof setupConvexTest>>;

  beforeEach(async () => {
    t = setupConvexTest();
  });

  describe("create (internal)", () => {
    it("should create chapter", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      const chapterId = await t.mutation(api.chapters.create, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Introduction",
        content: "This is the introduction section.",
        order: 0,
        speaker: "John Doe",
        startTime: 0,
        endTime: 120,
      });

      expect(chapterId).toBeDefined();

      const chapter = await t.run(async (ctx) => ctx.db.get(chapterId));
      expect(chapter).toBeDefined();
      expect(chapter?.title).toBe("Introduction");
      expect(chapter?.type).toBe(CHAPTER_TYPE.SECTION);
      expect(chapter?.speaker).toBe("John Doe");
      expect(chapter?.startTime).toBe(0);
      expect(chapter?.endTime).toBe(120);
      expect(chapter?.order).toBe(0);
    });
  });

  describe("listByTranscript", () => {
    it("should list chapters ordered by order field", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Chapter 1",
        content: "First chapter",
        order: 0,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Chapter 2",
        content: "Second chapter",
        order: 1,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.TOPIC,
        title: "Chapter 3",
        content: "Third chapter",
        order: 2,
      });

      const chapters = await identity.query(api.chapters.listByTranscript, {
        transcriptId,
      });

      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toBe("Chapter 1");
      expect(chapters[1].title).toBe("Chapter 2");
      expect(chapters[2].title).toBe("Chapter 3");
      expect(chapters[0].order).toBe(0);
      expect(chapters[1].order).toBe(1);
      expect(chapters[2].order).toBe(2);
    });

    it("should work for organization-shared project", async () => {
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
      const fileId = await createTestFile(t, { projectId, uploadedBy: owner });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Shared Chapter",
        content: "Content",
        order: 0,
      });

      const chapters = await memberIdentity.query(api.chapters.listByTranscript, {
        transcriptId,
      });

      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe("Shared Chapter");
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
      const fileId = await createTestFile(t, { projectId, uploadedBy: owner });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      await expect(
        otherIdentity.query(api.chapters.listByTranscript, { transcriptId })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("listByProject", () => {
    it("should list all chapters in a project", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });

      const file1 = await createTestFile(t, {
        projectId,
        uploadedBy: userId,
        name: "file1.mp3",
      });
      const file2 = await createTestFile(t, {
        projectId,
        uploadedBy: userId,
        name: "file2.mp3",
      });

      const transcript1 = await createTestTranscript(t, {
        fileId: file1,
        projectId,
      });
      const transcript2 = await createTestTranscript(t, {
        fileId: file2,
        projectId,
      });

      await createTestChapter(t, {
        transcriptId: transcript1,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "T1 Chapter 1",
        content: "Content",
        order: 0,
      });

      await createTestChapter(t, {
        transcriptId: transcript2,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "T2 Chapter 1",
        content: "Content",
        order: 0,
      });

      const chapters = await identity.query(api.chapters.listByProject, {
        projectId,
      });

      expect(chapters).toHaveLength(2);
      expect(chapters.map((c) => c.title)).toContain("T1 Chapter 1");
      expect(chapters.map((c) => c.title)).toContain("T2 Chapter 1");
    });

    it("should filter by chapter type", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Section Chapter",
        content: "Content",
        order: 0,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.TOPIC,
        title: "Topic Chapter",
        content: "Content",
        order: 1,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SPEAKER_TURN,
        title: "Speaker Turn",
        content: "Content",
        order: 2,
      });

      const allChapters = await identity.query(api.chapters.listByProject, {
        projectId,
      });

      expect(allChapters).toHaveLength(3);

      // Verify different types are present
      const types = allChapters.map((c) => c.type);
      expect(types).toContain(CHAPTER_TYPE.SECTION);
      expect(types).toContain(CHAPTER_TYPE.TOPIC);
      expect(types).toContain(CHAPTER_TYPE.SPEAKER_TURN);
    });

    it("should fail for user without project access", async () => {
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
        otherIdentity.query(api.chapters.listByProject, { projectId })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("Chapter ordering", () => {
    it("should maintain chapter order", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      // Create chapters out of order
      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Third",
        content: "3",
        order: 2,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "First",
        content: "1",
        order: 0,
      });

      await createTestChapter(t, {
        transcriptId,
        projectId,
        type: CHAPTER_TYPE.SECTION,
        title: "Second",
        content: "2",
        order: 1,
      });

      const chapters = await identity.query(api.chapters.listByTranscript, {
        transcriptId,
      });

      // Should be returned in order
      expect(chapters[0].title).toBe("First");
      expect(chapters[1].title).toBe("Second");
      expect(chapters[2].title).toBe("Third");
    });
  });
});
