# Soniox Async API v3 - Integration Guide

Complete documentation for Soniox Async API integration in Smart Transcribe.

## Overview

- **API Version**: v3 (stt-async-v3 model)
- **Endpoint**: `https://api.soniox.com/v1/transcriptions`
- **Documentation**: https://soniox.com/docs/stt/api-reference
- **Mode**: Asynchronous (for pre-recorded audio files)

## API Workflow

### 1. Create Transcription Job

**POST** `/v1/transcriptions`

```typescript
const response = await fetch("https://api.soniox.com/v1/transcriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SONIOX_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "stt-async-v3",
    audio_url: "https://...", // Public URL to audio file
    language_hints: ["en", "vi"], // Optional language hints
    enable_language_identification: true,
    enable_speaker_diarization: true,
    client_reference_id: "optional-ref-id",
  }),
});

const { id } = await response.json();
// Returns: { id: "uuid-of-transcription-job" }
```

### 2. Poll for Status

**GET** `/v1/transcriptions/{id}`

```typescript
const statusResponse = await fetch(
  `https://api.soniox.com/v1/transcriptions/${id}`,
  {
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
  }
);

const status = await statusResponse.json();
// Returns: { id, status: "processing" | "completed" | "error", error_message?: string }
```

**Recommended polling**: Every 5 seconds until status is `completed` or `error`

### 3. Retrieve Transcript

**GET** `/v1/transcriptions/{id}/transcript`

```typescript
const transcriptResponse = await fetch(
  `https://api.soniox.com/v1/transcriptions/${id}/transcript`,
  {
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
  }
);

const transcript = await transcriptResponse.json();
```

### 4. Clean Up

**DELETE** `/v1/transcriptions/{id}`

```typescript
await fetch(`https://api.soniox.com/v1/transcriptions/${id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
});
```

## Transcript Response Format

### Response Structure

```json
{
  "tokens": [
    {
      "text": "Hello",
      "start_ms": 600,
      "end_ms": 760,
      "confidence": 0.97,
      "is_final": true,
      "speaker": "1",
      "language": "en",
      "is_audio_event": null,
      "translation_status": null
    }
  ],
  "final_audio_proc_ms": 760,
  "total_audio_proc_ms": 880
}
```

### Token Fields

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Token text (word or subword) |
| `start_ms` | number | Start timestamp in milliseconds |
| `end_ms` | number | End timestamp in milliseconds |
| `confidence` | number | Confidence score (0.0 to 1.0) |
| `is_final` | boolean | Whether token is finalized (always true in async API) |
| `speaker` | string | Speaker identifier (e.g., "1", "2") when diarization enabled |
| `language` | string | Language code (e.g., "en", "vi") when language ID enabled |
| `is_audio_event` | boolean \| null | Audio event detection (null if not an event) |
| `translation_status` | string \| null | Translation status (null if not translating) |

### Processing Metadata

- **final_audio_proc_ms**: Total audio processed into final tokens (milliseconds)
- **total_audio_proc_ms**: Total audio processed including non-final tokens (milliseconds)

## Token Types

### Final vs Non-Final Tokens

**In Async API**: All tokens are final (`is_final: true`) since the entire audio is processed before returning results.

**In RT API**: Tokens can be non-final (`is_final: false`) for real-time streaming, but that's not used in our async implementation.

### Text Processing

Tokens represent:
- **Words**: Complete words
- **Subwords**: Parts of words (for better accuracy)
- **Spaces**: Spacing between words (sometimes)
- **Punctuation**: May be included in token text

**Concatenating text**: Simply join token text without additional spaces:
```typescript
const rawText = tokens.map(t => t.text).join("");
```

## Features Enabled

### Speaker Diarization

**Config**: `enable_speaker_diarization: true`

- Identifies different speakers in the audio
- Each token gets a `speaker` field (e.g., "1", "2", "3")
- Useful for conversations and interviews

**Example**:
```json
[
  { "text": "Hello", "speaker": "1" },
  { "text": "Hi", "speaker": "2" },
  { "text": "How", "speaker": "1" },
  { "text": "are", "speaker": "1" },
  { "text": "you", "speaker": "1" }
]
```

### Language Identification

**Config**: `enable_language_identification: true`

- Automatically detects language in multilingual audio
- Each token gets a `language` field (e.g., "en", "vi", "es")
- Works with `language_hints` to improve accuracy

**Example**:
```json
[
  { "text": "Hello", "language": "en" },
  { "text": "Xin", "language": "vi" },
  { "text": "chào", "language": "vi" }
]
```

## Models

### stt-async-v3

- **Use case**: Pre-recorded audio files
- **Processing**: Asynchronous (batch processing)
- **Accuracy**: Highest accuracy
- **Speed**: Processes faster than real-time
- **Cost**: Standard pricing

### Configuration Options

```typescript
{
  model: "stt-async-v3",

  // Language settings
  language_hints: ["en", "vi"],           // Priority languages
  enable_language_identification: true,   // Auto-detect languages

  // Speaker settings
  enable_speaker_diarization: true,       // Identify speakers
  num_speakers: 2,                        // Expected number of speakers (optional)

  // Audio input
  audio_url: "https://...",               // Public URL to audio file

  // Reference
  client_reference_id: "optional-id",     // Your own reference ID
}
```

## Implementation in Smart Transcribe

### File Upload Flow

1. User uploads audio file to Convex storage
2. Get public download URL from Convex
3. Create Soniox transcription job with `audio_url`
4. Poll for completion (5-second intervals)
5. Retrieve transcript with tokens
6. Store in database via `transcripts.createFromSoniox`
7. Delete Soniox transcription job

### Code Location

- **Action**: `convex/transcription.ts:120` - `transcribeFile`
- **Mutation**: `convex/transcripts.ts:121` - `createFromSoniox`
- **Type Definitions**: `convex/transcription.ts:23` - `SonioxToken`

### Validator Definition

```typescript
// convex/transcripts.ts:124-148
tokens: v.array(
  v.object({
    // Required fields
    text: v.string(),

    // Timing fields (in milliseconds)
    start_ms: v.optional(v.number()),
    end_ms: v.optional(v.number()),

    // Confidence and status
    confidence: v.optional(v.number()),
    is_final: v.optional(v.boolean()),

    // Speaker diarization
    speaker: v.optional(v.string()),

    // Language identification
    language: v.optional(v.string()),

    // Translation status (null if not translating)
    translation_status: v.optional(v.union(v.string(), v.null())),

    // Audio event detection (null if not an event)
    is_audio_event: v.optional(v.union(v.boolean(), v.null())),
  })
)
```

## Error Handling

### Common Errors

**ArgumentValidationError**: Token fields don't match validator
- **Cause**: Soniox response includes fields not in validator
- **Fix**: Update validator to include all possible fields (see above)

**401 Unauthorized**: Invalid API key
- **Check**: `SONIOX_API_KEY` environment variable is set correctly

**404 Not Found**: Transcription not found
- **Cause**: Transcription may have been deleted or never existed
- **Fix**: Verify transcription ID is correct

**Audio URL errors**: File not accessible
- **Cause**: Convex download URL expired or not public
- **Fix**: Generate fresh URL before creating transcription

**Timeout**: Transcription took too long
- **Current limit**: 10 minutes (120 attempts × 5 seconds)
- **Fix**: Increase timeout or split large files

### Best Practices

1. **Always clean up**: Delete transcription jobs after retrieving results
2. **Handle timeouts**: Set reasonable polling limits based on file size
3. **Retry logic**: Implement retry for transient network errors
4. **Split large files**: For files >60 minutes, split into 15-minute chunks
5. **Monitor API usage**: Track API calls to manage costs

## File Size Limits

- **Max file size**: Depends on Soniox plan (check documentation)
- **Recommended**: Split files >60 minutes into 15-minute chunks
- **Chunk overlap**: None needed (process sequentially)

## Timestamps

Soniox provides precise timestamps for every token:
- **Accuracy**: Millisecond precision
- **Always included**: No configuration needed
- **Use cases**:
  - Audio playback sync
  - Jump to specific sections
  - Time-based search
  - Caption generation

## Language Support

### Supported Languages

Soniox v3 supports 50+ languages. Common ones:
- English (en)
- Vietnamese (vi)
- Spanish (es)
- French (fr)
- German (de)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)

Full list: https://soniox.com/docs/stt/concepts/languages

### Language Hints

Provide hints for better accuracy:
```typescript
language_hints: ["en", "vi"]  // Prioritize English and Vietnamese
```

## Cost Optimization

1. **Use async API** for pre-recorded files (not RT API)
2. **Clean up jobs** after retrieving transcripts
3. **Split wisely**: Only split files that need it (>60 min)
4. **Cache results**: Store transcripts to avoid re-processing

## Useful Links

- [API Reference](https://soniox.com/docs/stt/api-reference)
- [Models Documentation](https://soniox.com/docs/stt/models)
- [Speaker Diarization Guide](https://soniox.com/docs/speech-to-text/guides/speaker-diarization)
- [Timestamps Documentation](https://soniox.com/docs/stt/concepts/timestamps)
- [Language Support](https://soniox.com/docs/stt/concepts/languages)

---

*Last updated: November 2025*
*API Version: v3*
