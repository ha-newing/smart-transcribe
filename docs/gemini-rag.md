# Gemini RAG Implementation Guide

## Overview

This guide explains how to implement Retrieval Augmented Generation (RAG) using Google's Gemini API with vector embeddings for semantic search in the Smart Transcribe application.

## Gemini Embedding Models (2025)

### Current Models
- **text-embedding-004**: Latest production model (recommended)
- **Dimensions**: 768 (default) with Matryoshka property support
- **Languages**: 100+ languages supported
- **Deprecation Notice**: embedding-001, embedding-gecko-001, gemini-embedding-exp-03-07 will be deprecated in October 2025

### Key Features
1. **Task-Specific Embeddings**: Different task types for documents vs queries
2. **Matryoshka Property**: Use compact representations with fewer dimensions
3. **Multilingual Support**: Works across 100+ languages
4. **State-of-the-Art Performance**: Top scores on MTEB (Massive Text Embedding Benchmark)

## RAG Architecture for Smart Transcribe

```
Audio/Video File → Transcription (Soniox) → Text Chunks
                                                ↓
                                         Gemini Embeddings
                                                ↓
                                    Store in Convex (Vector Index)
                                                ↓
User Query → Gemini Query Embedding → Vector Search → Top K Results
                                                ↓
                                    Context + Query → Gemini Pro
                                                ↓
                                        Grounded Answer
```

## Implementation Steps

### 1. Chunk Transcripts

```typescript
// Split transcript into semantic chunks
function chunkTranscript(transcript: string, maxChunkSize: number = 500) {
  // Use sentence boundaries for natural breaks
  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

### 2. Generate Embeddings

```typescript
// Convex action to generate embeddings using Gemini API
export const generateEmbeddings = action({
  args: {
    transcriptId: v.id("transcripts"),
  },
  handler: async (ctx, args) => {
    const transcript = await ctx.runQuery(api.transcripts.get, {
      transcriptId: args.transcriptId,
    });

    if (!transcript) {
      throw new Error("Transcript not found");
    }

    // Chunk the transcript
    const chunks = chunkTranscript(transcript.rawText);

    // Generate embeddings for each chunk
    const apiKey = process.env.GEMINI_API_KEY!;
    const embeddings = [];

    for (const chunk of chunks) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: {
              parts: [{ text: chunk }],
            },
            taskType: "RETRIEVAL_DOCUMENT", // Important for RAG!
          }),
        }
      );

      const data = await response.json();
      const embedding = data.embedding.values;

      embeddings.push({
        text: chunk,
        embedding: embedding,
      });
    }

    // Store embeddings in database
    for (const { text, embedding } of embeddings) {
      await ctx.runMutation(api.embeddings.create, {
        transcriptId: args.transcriptId,
        projectId: transcript.projectId,
        text,
        embedding,
      });
    }

    return { chunksProcessed: chunks.length };
  },
});
```

### 3. Semantic Search

```typescript
// Search for relevant chunks using vector similarity
export const semanticSearch = action({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Generate query embedding
    const apiKey = process.env.GEMINI_API_KEY!;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text: args.query }],
          },
          taskType: "RETRIEVAL_QUERY", // Different from document!
        }),
      }
    );

    const data = await response.json();
    const queryEmbedding = data.embedding.values;

    // Vector search using Convex
    const results = await ctx.vectorSearch("embeddings", "by_embedding", {
      vector: queryEmbedding,
      limit: args.limit || 5,
      filter: (q) => q.eq("projectId", args.projectId),
    });

    return results;
  },
});
```

### 4. Answer Questions with Context

```typescript
// RAG: Retrieve context and generate answer
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

    // 2. Build context from chunks
    const context = relevantChunks.map((chunk) => chunk.text).join("\n\n");

    // 3. Generate answer using Gemini Pro
    const apiKey = process.env.GEMINI_API_KEY!;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Based on the following transcript excerpts, answer the question.

Context:
${context}

Question: ${args.question}

Answer:`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const answer = data.candidates[0].content.parts[0].text;

    return {
      answer,
      sources: relevantChunks.map((c) => ({ text: c.text })),
    };
  },
});
```

## Task Types

### RETRIEVAL_DOCUMENT
Use for indexing documents/transcripts:
- Optimized for semantic similarity
- Better for large corpuses
- Use when creating embeddings for storage

### RETRIEVAL_QUERY
Use for search queries:
- Optimized for query-document matching
- Better matching with documents
- Use when searching/retrieving

## Best Practices

### 1. Chunk Size
- **Recommended**: 300-500 words per chunk
- **Why**: Balance between context and precision
- **Method**: Use sentence boundaries for natural breaks

### 2. Overlap
```typescript
// Add overlap between chunks for context continuity
function chunkWithOverlap(text: string, chunkSize: number, overlap: number) {
  // Implementation with 20% overlap
}
```

### 3. Metadata
Store metadata with embeddings:
```typescript
{
  text: "chunk text",
  embedding: [0.1, 0.2, ...],
  metadata: {
    startTime: 120,      // seconds
    endTime: 180,
    speaker: "Speaker 1",
    chapterId: "...",
  }
}
```

### 4. Cosine Similarity
Convex uses cosine similarity by default:
- Range: -1 (opposite) to 1 (most similar)
- Focus on direction, not magnitude
- Ideal for semantic similarity

### 5. Batch Processing
```typescript
// Process embeddings in batches to avoid rate limits
const BATCH_SIZE = 5;
for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(chunk => generateEmbedding(chunk)));
  await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
}
```

## Performance Optimization

### Matryoshka Embeddings
Use fewer dimensions for faster search:
```typescript
// Use 256 dimensions instead of 768 for 3x faster search
// Performance loss: < 5%
const compactEmbedding = fullEmbedding.slice(0, 256);
```

### Caching
Cache frequently asked questions:
```typescript
// Store popular Q&A pairs to avoid repeated searches
const cachedAnswer = await ctx.db
  .query("questionCache")
  .withIndex("by_question", (q) => q.eq("question", normalizedQuestion))
  .first();

if (cachedAnswer) return cachedAnswer.answer;
```

## Cost Optimization

### Gemini API Pricing (2025)
- **Embeddings**: Free (text-embedding-004)
- **Gemini Pro**: $0.00025 / 1K characters input
- **Storage**: Convex includes vector storage

### Tips
1. Use Matryoshka embeddings (fewer dimensions)
2. Cache common queries
3. Batch API calls
4. Use appropriate chunk sizes (not too small)

## Convex Vector Index Setup

Already configured in schema.ts:
```typescript
vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 768,
  filterFields: ["projectId"],
})
```

## Error Handling

```typescript
try {
  const embeddings = await generateEmbeddings(text);
} catch (error) {
  if (error.message.includes("rate limit")) {
    // Exponential backoff
    await sleep(1000 * retryCount);
    return retry();
  }
  throw error;
}
```

## Testing RAG Quality

### Metrics to Track
1. **Retrieval Precision**: Are retrieved chunks relevant?
2. **Answer Accuracy**: Does the answer match the transcript?
3. **Latency**: Time from query to answer
4. **Coverage**: Can it answer diverse questions?

### Example Test
```typescript
const testCases = [
  {
    question: "Who are the speakers in this meeting?",
    expectedKeywords: ["speaker", "participant"],
  },
  {
    question: "What were the key decisions made?",
    expectedKeywords: ["decision", "agreed", "action item"],
  },
];
```

## References

- [Gemini Embeddings Official Docs](https://ai.google.dev/gemini-api/docs/embeddings)
- [Build RAG with Gemini (Medium)](https://medium.com/google-cloud/build-a-rag-pipeline-with-gemini-embeddings-and-vector-search-a-deep-dive-full-code-bcd521ad9e1c)
- [Convex Vector Search](https://docs.convex.dev/search/vector-search)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)

## Next Steps

1. Implement embedding generation in `convex/embeddings.ts`
2. Create semantic search UI component
3. Add Q&A interface for transcripts
4. Monitor performance and optimize chunk sizes
5. Implement caching for common queries
