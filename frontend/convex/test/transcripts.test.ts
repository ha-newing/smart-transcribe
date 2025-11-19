import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { TRANSCRIPTION_STATUS } from "../../src/constants/enums";
import {
  setupConvexTest,
  createTestUser,
  createTestProject,
  createTestFile,
  createTestTranscript,
} from "./helpers";

describe("Transcripts API", () => {
  let t: Awaited<ReturnType<typeof setupConvexTest>>;

  beforeEach(async () => {
    t = setupConvexTest();
  });

  describe("getTranscript (public query)", () => {
    it("should get transcript for project owner", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
        rawText: "Test transcript text",
      });

      const transcript = await identity.query(api.transcripts.getTranscript, {
        transcriptId,
      });

      expect(transcript).toBeDefined();
      expect(transcript?.rawText).toBe("Test transcript text");
    });

    it("should get transcript for organization member", async () => {
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
        rawText: "Shared transcript",
      });

      const transcript = await memberIdentity.query(
        api.transcripts.getTranscript,
        { transcriptId }
      );

      expect(transcript).toBeDefined();
      expect(transcript?.rawText).toBe("Shared transcript");
    });

    it("should fail for unauthorized user", async () => {
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
        otherIdentity.query(api.transcripts.getTranscript, { transcriptId })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("listByProject", () => {
    it("should list all transcripts in a project", async () => {
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

      await createTestTranscript(t, {
        fileId: file1,
        projectId,
        rawText: "Transcript 1",
      });
      await createTestTranscript(t, {
        fileId: file2,
        projectId,
        rawText: "Transcript 2",
      });

      const transcripts = await identity.query(api.transcripts.listByProject, {
        projectId,
      });

      expect(transcripts).toHaveLength(2);
      expect(transcripts.map((t) => t.rawText)).toContain("Transcript 1");
      expect(transcripts.map((t) => t.rawText)).toContain("Transcript 2");
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
        otherIdentity.query(api.transcripts.listByProject, { projectId })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("createFromSoniox (internal)", () => {
    it("should create transcript from Soniox tokens", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });

      const tokens = [
        { text: "Hello ", is_final: true, speaker: "Speaker 1" },
        { text: "world", is_final: true, speaker: "Speaker 1" },
        { text: "!", is_final: true, speaker: "Speaker 2" },
      ];

      const transcriptId = await t.mutation(api.transcripts.createFromSoniox, {
        fileId,
        tokens,
        isPartial: false,
      });

      expect(transcriptId).toBeDefined();

      const transcript = await t.run(async (ctx) => ctx.db.get(transcriptId));
      expect(transcript).toBeDefined();
      expect(transcript?.rawText).toBe("Hello world!");
      expect(transcript?.speakers).toContain("Speaker 1");
      expect(transcript?.speakers).toContain("Speaker 2");
      expect(transcript?.speakers).toHaveLength(2);
    });

    it("should filter out non-final tokens", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });

      const tokens = [
        { text: "Hello", is_final: true },
        { text: " maybe", is_final: false }, // Should be filtered
        { text: " world", is_final: true },
      ];

      const transcriptId = await t.mutation(api.transcripts.createFromSoniox, {
        fileId,
        tokens,
        isPartial: false,
      });

      const transcript = await t.run(async (ctx) => ctx.db.get(transcriptId));
      expect(transcript?.rawText).toBe("Hello world");
    });

    it("should append to existing transcript when partial", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });

      // Create initial transcript
      const tokens1 = [{ text: "Part 1", is_final: true, speaker: "Speaker 1" }];
      const transcriptId = await t.mutation(api.transcripts.createFromSoniox, {
        fileId,
        tokens: tokens1,
        isPartial: false,
      });

      // Append partial data
      const tokens2 = [{ text: " Part 2", is_final: true, speaker: "Speaker 2" }];
      const transcriptId2 = await t.mutation(api.transcripts.createFromSoniox, {
        fileId,
        tokens: tokens2,
        isPartial: true,
      });

      expect(transcriptId).toBe(transcriptId2);

      const transcript = await t.run(async (ctx) => ctx.db.get(transcriptId));
      expect(transcript?.rawText).toContain("Part 1");
      expect(transcript?.rawText).toContain("Part 2");
      expect(transcript?.speakers).toHaveLength(2);
    });
  });

  describe("updateStatus (internal)", () => {
    it("should update transcript status", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
        status: TRANSCRIPTION_STATUS.PENDING,
      });

      await t.mutation(api.transcripts.updateStatus, {
        transcriptId,
        status: TRANSCRIPTION_STATUS.PROCESSING,
      });

      const transcript = await t.run(async (ctx) => ctx.db.get(transcriptId));
      expect(transcript?.status).toBe(TRANSCRIPTION_STATUS.PROCESSING);
    });
  });

  describe("updateStructured (internal)", () => {
    it("should update structured text and speakers", async () => {
      const { userId, companyId } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
        rawText: "raw text here",
      });

      await t.mutation(api.transcripts.updateStructured, {
        transcriptId,
        structuredText: "# Chapter 1\nStructured content here",
        speakers: ["John Doe", "Jane Smith"],
      });

      const transcript = await t.run(async (ctx) => ctx.db.get(transcriptId));
      expect(transcript?.structuredText).toBe(
        "# Chapter 1\nStructured content here"
      );
      expect(transcript?.speakers).toEqual(["John Doe", "Jane Smith"]);
    });
  });

  describe("combineTranscripts", () => {
    it("should combine multiple transcripts", async () => {
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
        rawText: "Transcript one content",
        structuredText: "# Part 1\nContent one",
        speakers: ["Speaker A"],
      });

      const transcript2 = await createTestTranscript(t, {
        fileId: file2,
        projectId,
        rawText: "Transcript two content",
        structuredText: "# Part 2\nContent two",
        speakers: ["Speaker B", "Speaker C"],
      });

      const combined = await identity.mutation(
        api.transcripts.combineTranscripts,
        {
          transcriptIds: [transcript1, transcript2],
          projectId,
          title: "Combined Meeting",
        }
      );

      expect(combined.rawText).toContain("Transcript one content");
      expect(combined.rawText).toContain("Transcript two content");
      expect(combined.structuredText).toContain("# Part 1");
      expect(combined.structuredText).toContain("# Part 2");
      expect(combined.speakers).toContain("Speaker A");
      expect(combined.speakers).toContain("Speaker B");
      expect(combined.speakers).toContain("Speaker C");
      expect(combined.speakers).toHaveLength(3);
      expect(combined.title).toBe("Combined Meeting");
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

      const fileId = await createTestFile(t, {
        projectId,
        uploadedBy: owner,
      });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
      });

      await expect(
        otherIdentity.mutation(api.transcripts.combineTranscripts, {
          transcriptIds: [transcriptId],
          projectId,
        })
      ).rejects.toThrow("Access denied");
    });

    it("should handle transcripts without structured text", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });

      const file1 = await createTestFile(t, {
        projectId,
        uploadedBy: userId,
      });

      const transcript1 = await createTestTranscript(t, {
        fileId: file1,
        projectId,
        rawText: "Raw only transcript",
        // No structuredText
      });

      const combined = await identity.mutation(
        api.transcripts.combineTranscripts,
        {
          transcriptIds: [transcript1],
          projectId,
        }
      );

      expect(combined.rawText).toBe("Raw only transcript");
      expect(combined.structuredText).toBeUndefined();
    });
  });
});
