import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database Schema for Smart Transcribe
 * Uses Convex Auth for authentication
 */

const schema = defineSchema({
  ...authTables,

  // Companies - one per email domain
  companies: defineTable({
    name: v.string(),
    domain: v.string(), // Email domain (e.g., "acme.com")
  }).index("by_domain", ["domain"]),

  // Users - extends Convex Auth users table
  // IMPORTANT: Must match authTables schema requirements
  users: defineTable({
    // Standard Convex Auth fields (all optional per auth requirements)
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom fields for our app (optional to allow auth sign-up to work)
    role: v.optional(v.string()), // USER_ROLES: ADMIN, EDITOR, VIEWER
    companyId: v.optional(v.id("companies")),
  })
    .index("email", ["email"]) // Required by Convex Auth - must be named "email"
    .index("phone", ["phone"]) // Required by Convex Auth - must be named "phone"
    .index("by_company", ["companyId"]),

  // Projects - containers for transcription work
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // PROJECT_STATUS: DRAFT, ACTIVE, COMPLETED, ARCHIVED
    companyId: v.id("companies"),
    createdBy: v.id("users"),
    sharedWithOrganization: v.boolean(), // If true, all company users can access
  }).index("by_company", ["companyId"])
    .index("by_creator", ["createdBy"])
    .index("by_status", ["status"]),

  // Project Shares - granular sharing with specific users
  projectShares: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    permission: v.string(), // SHARE_PERMISSION: VIEW, EDIT, ADMIN
    sharedBy: v.id("users"),
  }).index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_and_user", ["projectId", "userId"]),

  // Files - audio/video files uploaded for transcription
  files: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    size: v.number(), // bytes
    mimeType: v.string(),
    storageId: v.id("_storage"), // Convex file storage
    status: v.string(), // FILE_STATUS: UPLOADING, UPLOADED, PROCESSING, TRANSCRIBING, COMPLETED, FAILED
    duration: v.optional(v.number()), // seconds
    uploadedBy: v.id("users"),
  }).index("by_project", ["projectId"])
    .index("by_status", ["status"]),

  // Transcripts - transcription results
  transcripts: defineTable({
    fileId: v.optional(v.id("files")), // Single file (for individual transcripts)
    fileIds: v.optional(v.array(v.id("files"))), // Multiple files (for combined transcripts)
    projectId: v.id("projects"),
    rawText: v.string(), // Raw transcription from Soniox
    structuredText: v.optional(v.string()), // AI-processed structured version
    status: v.string(), // TRANSCRIPTION_STATUS: PENDING, PROCESSING, COMPLETED, FAILED
    language: v.optional(v.string()),
    speakers: v.optional(v.array(v.string())), // List of identified speakers
    title: v.optional(v.string()), // Title for combined transcripts
    isCombined: v.optional(v.boolean()), // Flag for combined transcripts
    metadata: v.optional(v.object({
      model: v.optional(v.string()),
      confidence: v.optional(v.number()),
      processingTime: v.optional(v.number()),
    })),
  }).index("by_file", ["fileId"])
    .index("by_project", ["projectId"])
    .index("by_status", ["status"]),

  // Chapters - structured sections of transcripts
  chapters: defineTable({
    transcriptId: v.id("transcripts"),
    projectId: v.id("projects"),
    type: v.string(), // CHAPTER_TYPE: SECTION, TOPIC, SPEAKER_TURN
    title: v.string(),
    content: v.string(),
    startTime: v.optional(v.number()), // seconds
    endTime: v.optional(v.number()), // seconds
    speaker: v.optional(v.string()),
    order: v.number(), // Display order
  }).index("by_transcript", ["transcriptId"])
    .index("by_project", ["projectId"])
    .index("by_order", ["transcriptId", "order"]),

  // Concepts - knowledge graph nodes for concept maps
  concepts: defineTable({
    projectId: v.id("projects"),
    transcriptId: v.id("transcripts"),
    concept: v.string(),
    description: v.optional(v.string()),
    relatedConcepts: v.array(v.id("concepts")), // Graph edges
    position: v.object({
      x: v.number(),
      y: v.number(),
    }), // For visualization
    metadata: v.optional(v.object({
      frequency: v.optional(v.number()),
      importance: v.optional(v.number()),
    })),
  }).index("by_project", ["projectId"])
    .index("by_transcript", ["transcriptId"]),

  // Embeddings - for RAG semantic search
  embeddings: defineTable({
    transcriptId: v.id("transcripts"),
    projectId: v.id("projects"),
    chapterId: v.optional(v.id("chapters")),
    text: v.string(), // The chunk of text
    embedding: v.array(v.float64()), // Vector embedding
    metadata: v.optional(v.object({
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      speaker: v.optional(v.string()),
    })),
  }).index("by_transcript", ["transcriptId"])
    .index("by_project", ["projectId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768, // Depends on embedding model (e.g., Gemini, OpenAI)
      filterFields: ["projectId"],
    }),
});

export default schema;
