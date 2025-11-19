# Testing Guide for Smart Transcribe

## Overview

This project uses `vitest` and `convex-test` for testing the Convex backend functions. We have comprehensive test coverage for all major APIs including transcription, embeddings, RAG, and user management.

## Test Structure

```
frontend/convex/test/
├── setup.ts              # Test environment setup
├── helpers.ts            # Test utilities and helpers
├── files.test.ts         # File upload and management tests (11 tests)
├── projects.test.ts      # Project CRUD and sharing tests (16 tests)
├── transcripts.test.ts   # Transcript management tests (13 tests)
├── chapters.test.ts      # Chapter management tests (8 tests)
├── embeddings.test.ts    # RAG and semantic search tests (6 tests)
├── transcription.test.ts # Transcription pipeline tests (11 tests)
└── users.test.ts         # Authentication and user tests (14 tests)

Total: 79 tests across 7 test files
```

## Test Coverage

### 1. Files API (`files.test.ts`)
- ✅ Upload URL generation
- ✅ File creation with access control
- ✅ File listing with project permissions
- ✅ File status updates
- ✅ Organization-wide and user-specific sharing

### 2. Projects API (`projects.test.ts`)
- ✅ Project CRUD operations
- ✅ Organization-wide project sharing
- ✅ User-specific project sharing
- ✅ Access control enforcement
- ✅ Project ownership validation

### 3. Transcripts API (`transcripts.test.ts`)
- ✅ Transcript creation from Soniox tokens
- ✅ Speaker diarization
- ✅ Multi-language support
- ✅ Partial transcript appending
- ✅ Transcript combining feature
- ✅ Structured text generation

### 4. Chapters API (`chapters.test.ts`)
- ✅ Chapter creation
- ✅ Chapter ordering
- ✅ Chapter listing by transcript
- ✅ Chapter listing by project
- ✅ Chapter type filtering (SECTION, TOPIC, SPEAKER_TURN)

### 5. Embeddings & RAG (`embeddings.test.ts`)
- ✅ Embedding generation (768-dimensional)
- ✅ Vector search functionality
- ✅ Semantic search with project filtering
- ✅ RAG-powered Q&A
- ✅ Context retrieval and answer generation

### 6. Transcription Pipeline (`transcription.test.ts`)
- ✅ Transcription initiation
- ✅ FFmpeg file splitting logic (>60 minutes)
- ✅ Soniox API integration (mocked)
- ✅ Status tracking through lifecycle
- ✅ Multi-language transcription
- ✅ Gemini AI processing

### 7. Users & Authentication (`users.test.ts`)
- ✅ Current user query
- ✅ Company auto-creation from email domain
- ✅ First user becomes Admin
- ✅ Subsequent users get Viewer role
- ✅ User role management (Admin only)
- ✅ User removal (Admin only)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Utilities

### `setupConvexTest()`
Creates a test environment with the Convex schema.

```typescript
const t = setupConvexTest();
```

### `createTestUser()`
Creates a test user with authentication identity.

```typescript
const { userId, companyId, identity } = await createTestUser(t, {
  email: "test@example.com",
  name: "Test User",
  role: USER_ROLES.ADMIN
});
```

### `createTestProject()`
Creates a test project.

```typescript
const projectId = await createTestProject(t, {
  companyId,
  createdBy: userId,
  sharedWithOrganization: true
});
```

### `createTestFile()`
Creates a test file with metadata.

```typescript
const fileId = await createTestFile(t, {
  projectId,
  uploadedBy: userId,
  duration: 1800 // 30 minutes
});
```

## Mocking External APIs

### Soniox API
```typescript
global.fetch = vi.fn(async (url, options) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: "test-transcription-id",
      status: "completed",
      tokens: [/* ... */]
    })
  } as Response;
});
```

### Gemini API
```typescript
mockFetch({
  embedding: { values: generateRandomEmbedding(768) }
});

// Or for text generation
mockFetch({
  candidates: [{
    content: {
      parts: [{ text: "Generated response" }]
    }
  }]
});
```

## Known Issues

### Convex-Test Module Loading
Currently experiencing an issue with `convex-test` module loading where it reports "module is not a function". This is related to the `import.meta.glob` pattern used to load Convex modules for testing.

**Status**: Under investigation
**Workaround**: Tests are structurally complete and can be run once the module loading is resolved.

**Solution approaches being explored**:
1. Adjusting the glob pattern in `helpers.ts`
2. Using Convex's built-in test utilities
3. Upgrading to latest convex-test version

## Best Practices

1. **Isolation**: Each test creates its own data (users, projects, files)
2. **Cleanup**: Tests use `beforeEach` to create fresh test environments
3. **Mocking**: External APIs (Soniox, Gemini) are mocked to avoid real API calls
4. **Auth Testing**: Use `identity.query()` and `identity.mutation()` for authenticated calls
5. **Access Control**: Every API has tests for both authorized and unauthorized access

## Test Patterns

### Testing Access Control
```typescript
it("should fail for unauthorized user", async () => {
  const { userId: owner, companyId } = await createTestUser(t, {
    email: "owner@example.com"
  });
  const { identity: otherIdentity } = await createTestUser(t, {
    email: "other@different.com"
  });

  const projectId = await createTestProject(t, {
    companyId,
    createdBy: owner,
    sharedWithOrganization: false
  });

  await expect(
    otherIdentity.query(api.projects.get, { projectId })
  ).rejects.toThrow("Access denied");
});
```

### Testing Organization Sharing
```typescript
it("should work for organization member", async () => {
  const { userId: owner, companyId } = await createTestUser(t, {
    email: "owner@example.com"
  });
  const { identity: memberIdentity } = await createTestUser(t, {
    email: "member@example.com",
    companyId // Same company
  });

  const projectId = await createTestProject(t, {
    companyId,
    createdBy: owner,
    sharedWithOrganization: true
  });

  const project = await memberIdentity.query(api.projects.get, { projectId });
  expect(project).toBeDefined();
});
```

## Environment Variables

Test environment variables are set in `convex/test/setup.ts`:

```typescript
process.env.SONIOX_API_KEY = "test-soniox-key";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.AUTH_SENDGRID_KEY = "test-sendgrid-key";
```

## Next Steps

1. **Fix Module Loading**: Resolve the convex-test module loading issue
2. **Integration Tests**: Add end-to-end integration tests
3. **CI/CD**: Set up GitHub Actions to run tests on PR
4. **Coverage Reporting**: Add coverage thresholds
5. **Performance Tests**: Add tests for large file handling

## References

- [Vitest Documentation](https://vitest.dev/)
- [Convex Test Documentation](https://docs.convex.dev/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
