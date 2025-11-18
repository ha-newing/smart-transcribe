import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Create embedding (internal - called by AI processing)
 */
export const create = internalMutation({
  args: {
    transcriptId: v.id("transcripts"),
    projectId: v.id("projects"),
    text: v.string(),
    embedding: v.array(v.float64()),
    chapterId: v.optional(v.id("chapters")),
    metadata: v.optional(
      v.object({
        startTime: v.optional(v.number()),
        endTime: v.optional(v.number()),
        speaker: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("embeddings", {
      transcriptId: args.transcriptId,
      projectId: args.projectId,
      text: args.text,
      embedding: args.embedding,
      chapterId: args.chapterId,
      metadata: args.metadata,
    });
  },
});

/**
 * Semantic search - find similar text chunks
 */
export const semanticSearch = action({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Generate query embedding
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: args.query }] },
          taskType: "RETRIEVAL_QUERY",
        }),
      }
    );

    const data = await response.json();
    const queryEmbedding = data.embedding.values;

    // Vector search
    const results = await ctx.vectorSearch("embeddings", "by_embedding", {
      vector: queryEmbedding,
      limit: args.limit || 5,
      filter: (q) => q.eq("projectId", args.projectId),
    });

    return results.map((result) => ({
      _id: result._id,
      text: result.text,
      score: result._score,
      metadata: result.metadata,
    }));
  },
});

/**
 * Answer question using RAG
 */
export const answerQuestion = action({
  args: {
    projectId: v.id("projects"),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Semantic search for relevant chunks
    const relevantChunks = await ctx.runAction(api.embeddings.semanticSearch, {
      projectId: args.projectId,
      query: args.question,
      limit: 5,
    });

    if (relevantChunks.length === 0) {
      return {
        answer: "I couldn't find any relevant information in the transcripts to answer this question.",
        sources: [],
      };
    }

    // 2. Build context
    const context = relevantChunks.map((chunk) => chunk.text).join("\n\n");

    // 3. Generate answer using Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const prompt = `Based on the following transcript excerpts, answer the question. Be concise and accurate. If the answer is not in the context, say so.

Context:
${context}

Question: ${args.question}

Answer:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const answer = data.candidates[0].content.parts[0].text;

    return {
      answer,
      sources: relevantChunks.map((c) => ({
        text: c.text,
        score: c.score,
      })),
    };
  },
});
