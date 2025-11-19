"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { FILE_STATUS, TRANSCRIPTION_STATUS } from "../src/constants/enums";

/**
 * Soniox API transcription using async API
 * Based on docs/soniox.md
 */

interface SonioxTranscriptionResponse {
  id: string;
  status: "processing" | "completed" | "error";
  error_message?: string;
}

/**
 * Soniox v3 RT API Token Response Format
 * Based on: https://soniox.com/docs/stt/rt/real-time-transcription
 */
interface SonioxToken {
  text: string;                      // Token text
  start_ms?: number;                 // Start timestamp (milliseconds)
  end_ms?: number;                   // End timestamp (milliseconds)
  confidence?: number;               // Confidence score (0-1)
  is_final?: boolean;                // Whether token is finalized
  speaker?: string;                  // Speaker label (if diarization enabled)
  language?: string;                 // Language (if identification enabled)
  translation_status?: string | null; // Translation status (null if not translating)
  is_audio_event?: boolean | null;   // Audio event detection (null if not an event)
}

interface SonioxTranscriptResponse {
  tokens: SonioxToken[];
}

/**
 * Start transcription for a file
 */
export const startTranscription = action({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.runQuery(api.files.get, { fileId: args.fileId });
    if (!file) {
      throw new Error("File not found");
    }

    // Update file status
    await ctx.runMutation(internal.files.updateStatus, {
      fileId: args.fileId,
      status: FILE_STATUS.PROCESSING,
    });

    // Get file URL from storage
    const fileUrl = await ctx.runQuery(api.files.getDownloadUrl, {
      storageId: file.storageId,
    });

    if (!fileUrl) {
      throw new Error("Could not get file URL");
    }

    // Check file duration - split if >60 minutes
    const shouldSplit = file.duration && file.duration > 3600; // 60 minutes in seconds

    if (shouldSplit) {
      // Schedule FFmpeg splitting
      await ctx.scheduler.runAfter(0, internal.transcription.splitAndTranscribe, {
        fileId: args.fileId,
        fileUrl,
      });
    } else {
      // Transcribe directly
      await ctx.scheduler.runAfter(0, internal.transcription.transcribeFile, {
        fileId: args.fileId,
        fileUrl,
        startTime: 0,
        isPartial: false,
      });
    }

    return { scheduled: true, willSplit: shouldSplit };
  },
});

/**
 * Split file using FFmpeg and transcribe each chunk
 */
export const splitAndTranscribe = internalAction({
  args: {
    fileId: v.id("files"),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.runQuery(api.files.get, { fileId: args.fileId });
    if (!file || !file.duration) {
      throw new Error("File not found or duration not set");
    }

    const CHUNK_DURATION = 900; // 15 minutes in seconds
    const totalChunks = Math.ceil(file.duration / CHUNK_DURATION);

    console.log(`Splitting file into ${totalChunks} chunks of 15 minutes each`);

    // Schedule transcription for each chunk
    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * CHUNK_DURATION;

      await ctx.scheduler.runAfter(i * 5000, internal.transcription.transcribeFile, {
        fileId: args.fileId,
        fileUrl: args.fileUrl,
        startTime,
        duration: CHUNK_DURATION,
        isPartial: true,
        chunkIndex: i,
        totalChunks,
      });
    }

    return { chunks: totalChunks };
  },
});

/**
 * Transcribe a file (or chunk) using Soniox API
 */
export const transcribeFile = internalAction({
  args: {
    fileId: v.id("files"),
    fileUrl: v.string(),
    startTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    isPartial: v.optional(v.boolean()),
    chunkIndex: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SONIOX_API_KEY;
    if (!apiKey) {
      throw new Error("SONIOX_API_KEY not configured");
    }

    // Update file status
    await ctx.runMutation(internal.files.updateStatus, {
      fileId: args.fileId,
      status: FILE_STATUS.TRANSCRIBING,
    });

    try {
      // Create transcription job
      const createResponse = await fetch(
        "https://api.soniox.com/v1/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "stt-async-preview",
            language_hints: ["en", "vi"],
            enable_language_identification: true,
            enable_speaker_diarization: true,
            audio_url: args.fileUrl,
            client_reference_id: `${args.fileId}-${args.chunkIndex || 0}`,
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error(`Soniox API error: ${createResponse.statusText}`);
      }

      const { id: transcriptionId } = (await createResponse.json()) as SonioxTranscriptionResponse;

      console.log(`Created Soniox transcription: ${transcriptionId}`);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max (5s intervals)

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await fetch(
          `https://api.soniox.com/v1/transcriptions/${transcriptionId}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        const status = (await statusResponse.json()) as SonioxTranscriptionResponse;

        if (status.status === "completed") {
          // Get transcript
          const transcriptResponse = await fetch(
            `https://api.soniox.com/v1/transcriptions/${transcriptionId}/transcript`,
            {
              headers: { Authorization: `Bearer ${apiKey}` },
            }
          );

          const transcript = (await transcriptResponse.json()) as SonioxTranscriptResponse;

          // Process and store transcript
          await ctx.runMutation(internal.transcripts.createFromSoniox, {
            fileId: args.fileId,
            tokens: transcript.tokens,
            isPartial: args.isPartial || false,
            chunkIndex: args.chunkIndex,
            totalChunks: args.totalChunks,
            startTime: args.startTime || 0,
          });

          // Clean up Soniox transcription
          await fetch(
            `https://api.soniox.com/v1/transcriptions/${transcriptionId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${apiKey}` },
            }
          );

          console.log(`Transcription completed: ${transcriptionId}`);
          break;
        } else if (status.status === "error") {
          throw new Error(`Soniox error: ${status.error_message}`);
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error("Transcription timeout");
      }

      // If this was the last chunk, mark file as completed
      if (!args.isPartial || (args.chunkIndex !== undefined && args.totalChunks !== undefined && args.chunkIndex === args.totalChunks - 1)) {
        await ctx.runMutation(internal.files.updateStatus, {
          fileId: args.fileId,
          status: FILE_STATUS.COMPLETED,
        });

        // Start AI processing
        const file = await ctx.runQuery(api.files.get, { fileId: args.fileId });
        if (file) {
          const transcript = await ctx.runQuery(internal.transcripts.getByFileId, {
            fileId: args.fileId,
          });

          if (transcript) {
            // Schedule Gemini processing
            await ctx.scheduler.runAfter(0, internal.transcription.processWithGemini, {
              transcriptId: transcript._id,
            });
          }
        }
      }

      return { success: true, transcriptionId };
    } catch (error) {
      console.error("Transcription error:", error);

      await ctx.runMutation(internal.files.updateStatus, {
        fileId: args.fileId,
        status: FILE_STATUS.FAILED,
      });

      throw error;
    }
  },
});

/**
 * Process transcript with Gemini to create structured document
 */
export const processWithGemini = internalAction({
  args: {
    transcriptId: v.id("transcripts"),
  },
  handler: async (ctx, args) => {
    const transcript = await ctx.runQuery(internal.transcripts.get, {
      transcriptId: args.transcriptId,
    });

    if (!transcript) {
      throw new Error("Transcript not found");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Update transcript status
    await ctx.runMutation(internal.transcripts.updateStatus, {
      transcriptId: args.transcriptId,
      status: TRANSCRIPTION_STATUS.PROCESSING,
    });

    try {
      // Generate structured document
      const structuredDoc = await generateStructuredDocument(
        apiKey,
        transcript.rawText
      );

      // Extract chapters
      const chapters = await extractChapters(apiKey, transcript.rawText);

      // Identify speakers
      const speakers = await identifySpeakers(apiKey, transcript.rawText);

      // Update transcript with structured content
      await ctx.runMutation(internal.transcripts.updateStructured, {
        transcriptId: args.transcriptId,
        structuredText: structuredDoc,
        speakers,
      });

      // Store chapters
      for (let i = 0; i < chapters.length; i++) {
        await ctx.runMutation(internal.chapters.create, {
          transcriptId: args.transcriptId,
          projectId: transcript.projectId,
          ...chapters[i],
          order: i,
        });
      }

      // Generate embeddings for RAG
      await ctx.scheduler.runAfter(0, internal.transcription.generateEmbeddings, {
        transcriptId: args.transcriptId,
      });

      // Mark as completed
      await ctx.runMutation(internal.transcripts.updateStatus, {
        transcriptId: args.transcriptId,
        status: TRANSCRIPTION_STATUS.COMPLETED,
      });

      return { success: true };
    } catch (error) {
      console.error("Gemini processing error:", error);

      await ctx.runMutation(internal.transcripts.updateStatus, {
        transcriptId: args.transcriptId,
        status: TRANSCRIPTION_STATUS.FAILED,
      });

      throw error;
    }
  },
});

/**
 * Generate structured document using Gemini
 */
async function generateStructuredDocument(
  apiKey: string,
  rawText: string
): Promise<string> {
  const prompt = `You are a professional transcript editor. Clean up and structure the following transcript:

1. Fix grammar and punctuation
2. Remove filler words (um, uh, like, you know)
3. Organize into clear paragraphs
4. Add section headers where appropriate
5. Maintain the original meaning and speaker intent

Transcript:
${rawText}

Provide the cleaned, structured transcript:`;

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
  return data.candidates[0].content.parts[0].text;
}

/**
 * Extract chapters from transcript using Gemini
 */
async function extractChapters(
  apiKey: string,
  rawText: string
): Promise<
  Array<{
    type: string;
    title: string;
    content: string;
    speaker?: string;
  }>
> {
  const prompt = `Analyze this transcript and divide it into logical chapters/sections.

For each chapter, provide:
1. A descriptive title
2. The chapter type (SECTION, TOPIC, or SPEAKER_TURN)
3. The content excerpt
4. The main speaker (if applicable)

Return as JSON array:
[
  {
    "title": "Introduction",
    "type": "SECTION",
    "content": "excerpt...",
    "speaker": "Speaker 1"
  }
]

Transcript:
${rawText}

JSON:`;

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
  const text = data.candidates[0].content.parts[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return [];
}

/**
 * Identify speakers from context using Gemini
 */
async function identifySpeakers(
  apiKey: string,
  rawText: string
): Promise<string[]> {
  const prompt = `Analyze this transcript and identify the speakers based on context clues.

List each speaker with their role or name if mentioned. If no names are mentioned, use descriptive labels like "Interviewer", "Guest", "Moderator", etc.

Return as JSON array of strings:
["Speaker 1 (Host)", "Speaker 2 (Guest Expert)", ...]

Transcript:
${rawText}

JSON:`;

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
  const text = data.candidates[0].content.parts[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return [];
}

/**
 * Generate embeddings for RAG
 */
export const generateEmbeddings = internalAction({
  args: {
    transcriptId: v.id("transcripts"),
  },
  handler: async (ctx, args) => {
    const transcript = await ctx.runQuery(internal.transcripts.get, {
      transcriptId: args.transcriptId,
    });

    if (!transcript) {
      throw new Error("Transcript not found");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Chunk the transcript (500 words per chunk)
    const chunks = chunkText(transcript.rawText, 500);

    console.log(`Generating embeddings for ${chunks.length} chunks`);

    // Generate embeddings in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: chunk }] },
                taskType: "RETRIEVAL_DOCUMENT",
              }),
            }
          );

          const data = await response.json();
          const embedding = data.embedding.values;

          await ctx.runMutation(internal.embeddings.create, {
            transcriptId: args.transcriptId,
            projectId: transcript.projectId,
            text: chunk,
            embedding,
          });
        })
      );

      // Rate limiting
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`Generated ${chunks.length} embeddings`);

    return { chunks: chunks.length };
  },
});

/**
 * Chunk text into smaller pieces
 */
function chunkText(text: string, maxWords: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const chunks: string[] = [];
  let currentChunk = "";
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;

    if (wordCount + sentenceWords > maxWords && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      wordCount = sentenceWords;
    } else {
      currentChunk += " " + sentence;
      wordCount += sentenceWords;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
