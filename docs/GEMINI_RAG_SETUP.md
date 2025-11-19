# Gemini RAG Setup with Convex

## Overview

This guide shows how to implement Retrieval Augmented Generation (RAG) using Google's Gemini API with Convex's RAG component. RAG enhances LLM responses by retrieving relevant context from your documents before generating answers.

## Why Convex RAG Component?

The Convex RAG component provides a complete, production-ready RAG solution:

- **Automatic chunking and embedding** - Handles text splitting and vector generation
- **Type-safe filtering** - Filter by user, project, or any custom metadata
- **Real-time sync** - Leverages Convex's reactive architecture
- **Minimal setup** - No manual schema or vector index configuration
- **Built-in best practices** - Optimized chunking, retrieval, and ranking
- **Low latency** - All data stays in Convex with fast vector search

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Implementation](#implementation)
- [Filtering by Metadata](#filtering-by-metadata)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install @convex-dev/rag @ai-sdk/google-vertex
```

---

## Configuration

### 1. Update Convex Config

**convex/convex.config.ts:**
```typescript
import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config.js";

const app = defineApp();
app.use(rag);
export default app;
```

### 2. Set Environment Variables

Add your Gemini API key to Convex:

```bash
npx convex env set GEMINI_API_KEY AIzaSyCWCLPIleN47swPSMCNDBHwvGvmii3bbDc
```

### 3. Embedding Dimensions

Gemini supports flexible output dimensions:

- **768**: Good balance of performance and storage ✅ Recommended for most use cases
- **1536**: Better quality, more storage
- **3072**: Highest quality (default), most storage

---

## Implementation

### Basic Setup

**convex/rag.ts:**
```typescript
import { RAG } from "@convex-dev/rag";
import { google } from "@ai-sdk/google-vertex";
import { components } from "./_generated/api";
import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Define filter types for type safety
type FilterTypes = {
  userId: string;
  projectId: string;
  transcriptId: string;
  category: string;
};

const rag = new RAG<FilterTypes>(components.rag, {
  textEmbeddingModel: google.embedding("text-embedding-004"),
  embeddingDimension: 768,
  filterNames: ["userId", "projectId", "transcriptId", "category"],
});

/**
 * Add a document to the RAG index
 */
export const addDocument = action({
  args: {
    content: v.string(),
    projectId: v.id("projects"),
    transcriptId: v.optional(v.id("transcripts")),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current);
    if (!user) throw new Error("Not authenticated");

    await rag.add(ctx, {
      namespace: args.projectId, // Organize by project
      text: args.content,
      key: args.transcriptId, // Optional: use transcript ID as key for updates
      filterValues: [
        { name: "userId", value: user._id },
        { name: "projectId", value: args.projectId },
        ...(args.transcriptId ? [{ name: "transcriptId", value: args.transcriptId }] : []),
        ...(args.category ? [{ name: "category", value: args.category }] : []),
      ],
      metadata: {
        title: args.title,
        createdAt: Date.now(),
      },
    });

    return { success: true };
  },
});

/**
 * Search documents with filters
 */
export const search = action({
  args: {
    query: v.string(),
    projectId: v.id("projects"),
    transcriptId: v.optional(v.id("transcripts")),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
    scoreThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current);
    if (!user) throw new Error("Not authenticated");

    // Build filters (same name = OR, different names = AND)
    const filters = [
      { name: "userId", value: user._id },
      { name: "projectId", value: args.projectId },
    ];

    if (args.transcriptId) {
      filters.push({ name: "transcriptId", value: args.transcriptId });
    }

    if (args.category) {
      filters.push({ name: "category", value: args.category });
    }

    const { results, text, entries } = await rag.search(ctx, {
      namespace: args.projectId,
      query: args.query,
      filters,
      limit: args.limit ?? 5,
      vectorScoreThreshold: args.scoreThreshold ?? 0.7,
    });

    return {
      results,
      formattedText: text, // Pre-formatted context for LLM
      entries, // Detailed chunk information
    };
  },
});

/**
 * Replace/update a document
 */
export const updateDocument = action({
  args: {
    transcriptId: v.id("transcripts"),
    projectId: v.id("projects"),
    content: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current);
    if (!user) throw new Error("Not authenticated");

    // Using the same key will replace the existing document
    await rag.add(ctx, {
      namespace: args.projectId,
      text: args.content,
      key: args.transcriptId,
      filterValues: [
        { name: "userId", value: user._id },
        { name: "projectId", value: args.projectId },
        { name: "transcriptId", value: args.transcriptId },
      ],
      metadata: {
        title: args.title,
        updatedAt: Date.now(),
      },
    });

    return { success: true };
  },
});

/**
 * Delete a document
 */
export const deleteDocument = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await rag.delete(ctx, {
      namespace: args.projectId,
      key: args.transcriptId,
    });

    return { success: true };
  },
});
```

---

## Filtering by Metadata

The RAG component supports powerful filtering capabilities:

### Filter Logic

- **Same filter name** = OR logic (e.g., multiple categories)
- **Different filter names** = AND logic (e.g., userId AND projectId)

### Example: Multiple Categories (OR)

```typescript
const results = await rag.search(ctx, {
  namespace: projectId,
  query: "What was discussed?",
  filters: [
    { name: "userId", value: currentUserId },
    { name: "category", value: "interview" },
    { name: "category", value: "meeting" }, // OR with above
  ],
});
// Returns: userId matches AND (category is "interview" OR "meeting")
```

### Example: Complex Filters (AND)

```typescript
type FilterTypes = {
  userId: string;
  projectId: string;
  // Composite filter for AND logic
  projectAndCategory: { projectId: string; category: string };
};

const rag = new RAG<FilterTypes>(components.rag, {
  textEmbeddingModel: google.embedding("text-embedding-004"),
  embeddingDimension: 768,
  filterNames: ["userId", "projectId", "projectAndCategory"],
});

// Use composite filter
await rag.add(ctx, {
  namespace: projectId,
  text: content,
  filterValues: [
    { name: "userId", value: userId },
    {
      name: "projectAndCategory",
      value: { projectId, category: "interview" },
    },
  ],
});
```

---

## Usage Examples

### Frontend: Semantic Search

```typescript
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export function SemanticSearch({ projectId }: { projectId: Id<"projects"> }) {
  const search = useAction(api.rag.search);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);

  const handleSearch = async () => {
    const searchResults = await search({
      query,
      projectId,
      limit: 5,
      scoreThreshold: 0.7,
    });
    setResults(searchResults);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your transcripts..."
      />
      <button onClick={handleSearch}>Search</button>

      {results && (
        <div>
          <h3>Results ({results.entries.length})</h3>
          {results.entries.map((entry: any, idx: number) => (
            <div key={idx}>
              <p>Score: {entry.score.toFixed(3)}</p>
              <p>{entry.text}</p>
            </div>
          ))}

          <h3>Formatted Context (for LLM)</h3>
          <pre>{results.formattedText}</pre>
        </div>
      )}
    </div>
  );
}
```

### Backend: RAG-powered Q&A

**convex/ai.ts:**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const answerQuestion = action({
  args: {
    question: v.string(),
    projectId: v.id("projects"),
    transcriptId: v.optional(v.id("transcripts")),
  },
  handler: async (ctx, args) => {
    // Step 1: Retrieve relevant context using RAG
    const { formattedText, entries } = await ctx.runAction(api.rag.search, {
      query: args.question,
      projectId: args.projectId,
      transcriptId: args.transcriptId,
      limit: 5,
      scoreThreshold: 0.6,
    });

    if (!entries.length) {
      return {
        answer: "I couldn't find relevant information to answer this question.",
        sources: [],
      };
    }

    // Step 2: Generate answer using Gemini with retrieved context
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Based on the following context from transcripts, answer the question accurately and concisely. If the context doesn't contain enough information, say so.

Context:
${formattedText}

Question: ${args.question}

Answer:`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    return {
      answer,
      sources: entries.map((entry: any) => ({
        text: entry.text,
        score: entry.score,
        metadata: entry.metadata,
      })),
    };
  },
});
```

### Automatic Indexing on Transcript Creation

**convex/transcripts.ts:**
```typescript
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    audioUrl: v.string(),
    // ... other args
  },
  handler: async (ctx, args) => {
    const transcriptId = await ctx.db.insert("transcripts", {
      projectId: args.projectId,
      status: "processing",
      // ... other fields
    });

    // Schedule RAG indexing after transcription completes
    await ctx.scheduler.runAfter(0, api.rag.addDocument, {
      content: "transcript content here",
      projectId: args.projectId,
      transcriptId,
      title: "Transcript title",
    });

    return transcriptId;
  },
});
```

---

## Best Practices

### 1. Namespacing Strategy

- Use `projectId` as namespace for multi-project isolation
- For global search across projects, use a shared namespace (e.g., "global")
- Combine with filters for fine-grained access control

### 2. Chunking

The RAG component handles chunking automatically, but keep in mind:

- Optimal chunk size: 500-1500 characters
- Semantic boundaries preserved (paragraphs/sentences)
- Automatic overlap between chunks

### 3. Search Optimization

- **Score threshold**: Start with 0.7, adjust based on results
  - Higher (0.8+): More precise, fewer results
  - Lower (0.5-0.6): More recall, potentially less relevant
- **Limit**: Use 5-10 results for RAG context to avoid token limits
- **Filters**: Always filter by `userId` for security

### 4. Cost Optimization

- **Use 768 dimensions** - Excellent quality/cost ratio
- **Incremental updates** - Only re-index changed content
- **Namespace wisely** - Avoid unnecessary global searches

### 5. Security

```typescript
// ✅ Good: Always filter by userId
const results = await rag.search(ctx, {
  namespace: projectId,
  query: userQuery,
  filters: [
    { name: "userId", value: currentUser._id }, // Prevent data leakage
  ],
});

// ❌ Bad: No user filtering
const results = await rag.search(ctx, {
  namespace: projectId,
  query: userQuery,
});
```

### 6. Performance Tips

- **Namespace first**: Narrow search scope with namespaces
- **Add filters**: More filters = faster, more relevant results
- **Batch indexing**: When adding many documents, use actions
- **Cache results**: Store frequently accessed answers

---

## Troubleshooting

### No results returned

**Symptoms:** Search returns empty array or no entries

**Solutions:**
1. Lower `vectorScoreThreshold` (try 0.5 or 0.6)
2. Verify documents are indexed:
   ```typescript
   // Check if content exists in namespace
   const { entries } = await rag.search(ctx, {
     namespace: projectId,
     query: "any text",
     limit: 100,
     vectorScoreThreshold: 0.0,
   });
   console.log(`Found ${entries.length} chunks`);
   ```
3. Check filter values match exactly (case-sensitive)
4. Verify namespace is correct

### Poor search quality

**Symptoms:** Irrelevant results, low scores

**Solutions:**
1. Increase `vectorScoreThreshold` (try 0.75-0.8)
2. Improve query specificity
3. Check if content is properly chunked
4. Consider using 1536 dimensions for better quality

### Slow performance

**Symptoms:** Search takes >2 seconds

**Solutions:**
1. Add more specific filters to reduce search space
2. Reduce `limit` parameter
3. Use narrower namespaces
4. Check if you're running many searches in parallel

### Updates not reflected

**Symptoms:** Search returns old content after update

**Solutions:**
1. Ensure you're using the same `key` for updates
2. Wait a moment for async indexing to complete
3. Verify the update action completed successfully

### Type errors with filters

**Symptoms:** TypeScript errors on filter values

**Solution:**
```typescript
// ✅ Define filter types upfront
type FilterTypes = {
  userId: string;
  projectId: string;
};

const rag = new RAG<FilterTypes>(components.rag, {
  // ...
  filterNames: ["userId", "projectId"],
});
```

---

## Next Steps

1. ✅ **Install dependencies**: `npm install @convex-dev/rag @ai-sdk/google-vertex`
2. ✅ **Configure Convex**: Update `convex.config.ts`
3. ✅ **Set API key**: `npx convex env set GEMINI_API_KEY ...`
4. ✅ **Implement RAG**: Create `convex/rag.ts` with the code above
5. ✅ **Test search**: Index a sample transcript and test queries
6. ✅ **Add to UI**: Integrate search into your frontend
7. ✅ **Auto-index**: Hook into transcript creation to auto-index

---

## Resources

- [Convex RAG Component Docs](https://www.convex.dev/components/rag)
- [Convex RAG with Agents](https://docs.convex.dev/agents/rag)
- [Gemini Embeddings API](https://ai.google.dev/gemini-api/docs/embeddings)
- [Convex Vector Search](https://docs.convex.dev/search/vector-search)
- [RAG Best Practices](https://www.convex.dev/can-do/rag)
