import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { api } from "../_generated/api";
import {
  setupConvexTest,
  createTestUser,
  createTestProject,
  createTestFile,
  createTestTranscript,
  createTestEmbedding,
  generateRandomEmbedding,
  mockFetch,
  restoreFetch,
} from "./helpers";

describe("Embeddings and RAG", () => {
  let t: Awaited<ReturnType<typeof setupConvexTest>>;

  beforeEach(async () => {
    t = setupConvexTest();
  });

  afterEach(() => {
    restoreFetch();
  });

  describe("create (internal)", () => {
    it("should create embedding", async () => {
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

      const embedding = generateRandomEmbedding(768);

      const embeddingId = await t.mutation(api.embeddings.create, {
        transcriptId,
        projectId,
        text: "This is a test chunk of text for embedding.",
        embedding,
      });

      expect(embeddingId).toBeDefined();

      const created = await t.run(async (ctx) => ctx.db.get(embeddingId));
      expect(created).toBeDefined();
      expect(created?.text).toBe("This is a test chunk of text for embedding.");
      expect(created?.embedding).toHaveLength(768);
      expect(created?.transcriptId).toBe(transcriptId);
      expect(created?.projectId).toBe(projectId);
    });

    it("should create embedding with chapter metadata", async () => {
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

      const chapterId = await t.run(async (ctx) => {
        return await ctx.db.insert("chapters", {
          transcriptId,
          projectId,
          type: "SECTION",
          title: "Test Chapter",
          content: "Content",
          order: 0,
        });
      });

      const embedding = generateRandomEmbedding(768);

      const embeddingId = await t.mutation(api.embeddings.create, {
        transcriptId,
        projectId,
        text: "Chapter text",
        embedding,
        chapterId,
        metadata: {
          startTime: 100,
          endTime: 200,
          speaker: "John Doe",
        },
      });

      const created = await t.run(async (ctx) => ctx.db.get(embeddingId));
      expect(created?.chapterId).toBe(chapterId);
      expect(created?.metadata?.startTime).toBe(100);
      expect(created?.metadata?.endTime).toBe(200);
      expect(created?.metadata?.speaker).toBe("John Doe");
    });
  });

  describe("semanticSearch", () => {
    it("should perform semantic search", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });
      const fileId = await createTestFile(t, { projectId, uploadedBy: userId });
      const transcriptId = await createTestTranscript(t, {
        fileId,
        projectId,
        rawText: "Meeting about Q4 results",
      });

      // Create embeddings
      const embedding1 = generateRandomEmbedding(768);
      const embedding2 = generateRandomEmbedding(768);

      await createTestEmbedding(t, {
        transcriptId,
        projectId,
        text: "We discussed Q4 financial results and revenue growth.",
        embedding: embedding1,
      });

      await createTestEmbedding(t, {
        transcriptId,
        projectId,
        text: "The team talked about marketing strategies for next year.",
        embedding: embedding2,
      });

      // Mock Gemini API for query embedding
      const queryEmbedding = generateRandomEmbedding(768);
      mockFetch({
        embedding: { values: queryEmbedding },
      });

      const results = await identity.action(api.embeddings.semanticSearch, {
        projectId,
        query: "What were the Q4 results?",
        limit: 2,
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Vector search will return results based on similarity
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should filter by project", async () => {
      const { userId: user1, companyId: company1 } = await createTestUser(t, {
        email: "user1@company1.com",
      });
      const { userId: user2, companyId: company2, identity: user2Identity } =
        await createTestUser(t, {
          email: "user2@company2.com",
        });

      // Create project and embeddings for user1
      const project1 = await createTestProject(t, {
        companyId: company1,
        createdBy: user1,
      });
      const file1 = await createTestFile(t, {
        projectId: project1,
        uploadedBy: user1,
      });
      const transcript1 = await createTestTranscript(t, {
        fileId: file1,
        projectId: project1,
      });
      await createTestEmbedding(t, {
        transcriptId: transcript1,
        projectId: project1,
        text: "Project 1 content",
        embedding: generateRandomEmbedding(768),
      });

      // Create project and embeddings for user2
      const project2 = await createTestProject(t, {
        companyId: company2,
        createdBy: user2,
      });
      const file2 = await createTestFile(t, {
        projectId: project2,
        uploadedBy: user2,
      });
      const transcript2 = await createTestTranscript(t, {
        fileId: file2,
        projectId: project2,
      });
      await createTestEmbedding(t, {
        transcriptId: transcript2,
        projectId: project2,
        text: "Project 2 content",
        embedding: generateRandomEmbedding(768),
      });

      // Mock Gemini API
      mockFetch({ embedding: { values: generateRandomEmbedding(768) } });

      // Search in project2 should only return project2 embeddings
      const results = await user2Identity.action(api.embeddings.semanticSearch, {
        projectId: project2,
        query: "content",
        limit: 5,
      });

      expect(results).toBeDefined();
      // Should only return embeddings from project2
      if (results.length > 0) {
        expect(results.every((r) => r.text.includes("Project 2"))).toBe(true);
      }
    });
  });

  describe("answerQuestion", () => {
    it("should answer question using RAG", async () => {
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

      // Create embeddings
      await createTestEmbedding(t, {
        transcriptId,
        projectId,
        text: "The revenue for Q4 was $10 million, a 20% increase from Q3.",
        embedding: generateRandomEmbedding(768),
      });

      await createTestEmbedding(t, {
        transcriptId,
        projectId,
        text: "We plan to expand into new markets in 2025.",
        embedding: generateRandomEmbedding(768),
      });

      // Mock API calls
      let callCount = 0;
      global.fetch = vi.fn(async (url: any) => {
        callCount++;

        if (callCount === 1) {
          // First call: embedContent for query embedding
          return {
            ok: true,
            status: 200,
            json: async () => ({
              embedding: { values: generateRandomEmbedding(768) },
            }),
          } as Response;
        } else {
          // Second call: generateContent for answer
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: "The Q4 revenue was $10 million, representing a 20% increase from the previous quarter.",
                      },
                    ],
                  },
                },
              ],
            }),
          } as Response;
        }
      });

      const result = await identity.action(api.embeddings.answerQuestion, {
        projectId,
        question: "What was the Q4 revenue?",
      });

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(typeof result.answer).toBe("string");
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);

      restoreFetch();
    });

    it("should handle no relevant chunks found", async () => {
      const { userId, companyId, identity } = await createTestUser(t);
      const projectId = await createTestProject(t, {
        companyId,
        createdBy: userId,
      });

      // Mock embedContent to return embedding
      mockFetch({
        embedding: { values: generateRandomEmbedding(768) },
      });

      // No embeddings in database, so vector search returns empty
      const result = await identity.action(api.embeddings.answerQuestion, {
        projectId,
        question: "What is the meaning of life?",
      });

      expect(result).toBeDefined();
      expect(result.answer).toContain("couldn't find any relevant information");
      expect(result.sources).toEqual([]);
    });
  });
});
