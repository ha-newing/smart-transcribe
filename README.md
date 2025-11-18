# Smart Transcribe

An intelligent transcription platform that allows users to upload audio/video files, transcribe them using AI, and organize transcripts with features like speaker identification, chapters, concept maps, and semantic search.

## Features

### ✅ Implemented (Phase 1)
- **Authentication**: Magic link login with SendGrid
- **Company Management**: Automatic company creation from email domain
- **User Roles**: Admin, Editor, Viewer with role-based permissions
- **Project System**: Create and manage transcription projects
- **Database Schema**: Complete schema for companies, users, projects, files, transcripts, chapters, concepts, and embeddings
- **i18n Support**: English and Vietnamese translations
- **Dark/Light Theme**: Theme-ready with Tailwind CSS 4
- **Mobile-First Design**: Responsive UI with shadcn/ui components

### 🚧 To Be Implemented (Phase 2)
- **File Upload**: Multi-file upload with Convex file storage
- **FFmpeg Integration**: Automatic splitting of audio files >60 minutes
- **Soniox Transcription**: Speech-to-text with speaker diarization
- **AI Processing**: Gemini-powered structured documents with chapters and speaker identification
- **RAG System**: Semantic search using vector embeddings
- **Concept Maps**: AI-generated knowledge graphs
- **Transcript Viewer**: Chapter navigation and speaker-based browsing

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Convex (serverless)
- **Auth**: Convex Auth + SendGrid (magic links)
- **UI**: shadcn/ui + Tailwind CSS 4
- **Transcription**: Soniox API
- **AI**: Google Gemini API
- **i18n**: react-i18next

## Project Structure

```
smart-transcribe/
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   └── layout/       # Layout components
│   │   ├── pages/            # Page components
│   │   │   ├── auth/         # Authentication pages
│   │   │   └── transcribe/   # Transcription pages
│   │   ├── lib/              # Utilities
│   │   ├── hooks/            # Custom React hooks
│   │   ├── constants/        # Enums and constants
│   │   ├── types/            # TypeScript types
│   │   └── i18n/             # Internationalization
│   ├── convex/               # Convex backend
│   │   ├── schema.ts         # Database schema
│   │   ├── auth.ts           # Authentication config
│   │   ├── users.ts          # User functions
│   │   └── projects.ts       # Project functions
│   └── public/               # Static assets
├── .env                      # Environment variables
├── Makefile                  # Development commands
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- A SendGrid account and API key
- Convex account (sign up at https://convex.dev)

### 1. Environment Variables

The `.env` file in the project root contains all necessary API keys:

```bash
# Already configured
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
SENDGRID_FROM_NAME=...
SONIOX_API_KEY=...
GEMINI_API_KEY=...
CLAUDE_API_KEY=...
AZURE_STORAGE_CONNECTION_STRING=...
```

### 2. Install Dependencies

```bash
make install
```

### 3. Initialize Convex

```bash
cd frontend
npx convex dev
```

This will:
1. Prompt you to create a new Convex project (or select existing)
2. Generate your `VITE_CONVEX_URL`
3. Create the `convex/_generated/` folder with type definitions
4. Start the Convex development server

**Important**: Copy the `VITE_CONVEX_URL` to `frontend/.env.local`:

```bash
# frontend/.env.local
VITE_CONVEX_URL=https://your-project.convex.cloud
```

### 4. Sync Environment Variables to Convex

```bash
make convex-env-sync
```

This syncs all API keys from `.env` to your Convex backend.

### 5. Run Development Servers

**Terminal 1 - Convex Backend:**
```bash
make convex-dev
# or: cd frontend && npx convex dev
```

**Terminal 2 - Frontend:**
```bash
make dev
# or: cd frontend && npm run dev
```

### 6. Access the App

Open http://localhost:5173 in your browser.

## Development Commands

All commands are available via the Makefile:

```bash
make help              # Show all available commands
make install           # Install dependencies
make dev               # Run frontend dev server
make convex-dev        # Run Convex backend dev
make build             # Build for production
make lint              # Run linter
make convex-deploy     # Deploy Convex to production
make convex-env-sync   # Sync .env to Convex
make clean             # Clean build artifacts
```

## How It Works

### Authentication Flow

1. User enters email on login page
2. SendGrid sends magic link email
3. User clicks link → automatically logged in
4. First user from an email domain becomes **Admin** of their company
5. Subsequent users from the same domain become **Viewers**

### Company Auto-Creation

When a user signs up with `user@acme.com`:
1. System checks if company with domain `acme.com` exists
2. If not, creates a new company named "Acme"
3. Links the user to this company
4. First user gets Admin role, others get Viewer role

### User Roles

- **Admin**: Full access, can manage users and all projects
- **Editor**: Can create and edit projects
- **Viewer**: Read-only access to shared projects

### Project Sharing

Projects can be shared in two ways:
1. **Organization-wide**: All users in the company can access
2. **Individual users**: Share with specific permissions (View, Edit, Admin)

## Database Schema

### Core Tables

- **companies**: One per email domain (e.g., "@acme.com" → Acme company)
- **users**: User accounts with role and company association
- **projects**: Transcription project containers
- **projectShares**: Granular sharing permissions
- **files**: Uploaded audio/video files
- **transcripts**: Transcription results (raw + structured)
- **chapters**: AI-extracted sections and topics
- **concepts**: Knowledge graph nodes for concept maps
- **embeddings**: Vector embeddings for semantic search (RAG)

### Enums (Single Source of Truth)

Located in `frontend/src/constants/enums.ts`:

- `USER_ROLES`: ADMIN, EDITOR, VIEWER
- `PROJECT_STATUS`: DRAFT, ACTIVE, COMPLETED, ARCHIVED
- `FILE_STATUS`: UPLOADING, UPLOADED, PROCESSING, TRANSCRIBING, COMPLETED, FAILED
- `TRANSCRIPTION_STATUS`: PENDING, PROCESSING, COMPLETED, FAILED
- `SHARE_PERMISSION`: VIEW, EDIT, ADMIN
- `CHAPTER_TYPE`: SECTION, TOPIC, SPEAKER_TURN

## Architecture Principles

From `CLAUDE.md`:

1. **Direct Convex Pattern**: Use Convex hooks directly in components (no service layer)
   ```tsx
   // ✅ Correct
   const projects = useQuery(api.projects.list, {});
   const createProject = useMutation(api.projects.create);
   ```

2. **State Management**:
   - **Convex**: Server state (database, auth, real-time sync)
   - **Zustand**: Client state (UI preferences, theme, language)

3. **Enums**: Always use enum constants from `/src/constants/enums.ts`

4. **Mobile-First**: All designs are mobile-first and desktop-friendly

5. **i18n**: All user-facing text uses translation keys

## Next Steps

### Phase 2: Core Transcription Features

1. **File Upload System**
   - Multi-file upload UI
   - Convex file storage integration
   - Progress tracking

2. **FFmpeg Processing**
   - Split audio files >60 minutes into 15-minute segments
   - Automatic chunking for large files

3. **Soniox Integration**
   - Real-time transcription
   - Speaker diarization
   - Language identification

4. **AI Processing with Gemini**
   - Structure raw transcripts
   - Extract chapters and sections
   - Identify speakers from context
   - Generate summaries

5. **RAG System**
   - Generate embeddings for transcript chunks
   - Vector search with Convex
   - Semantic retrieval

6. **Concept Map Generation**
   - Extract key concepts
   - Build knowledge graph
   - Interactive visualization

7. **Transcript Viewer**
   - Chapter navigation
   - Speaker filtering
   - Search and highlight
   - Export options

## Deployment

### Convex Backend

```bash
cd frontend
npx convex deploy --prod

# Set production environment variables
npx convex env set AUTH_SENDGRID_KEY "your-key" --prod
# ... (repeat for all env vars)
```

### Frontend (Fly.io)

```bash
fly deploy
```

## Contributing

1. Follow the architecture principles in `CLAUDE.md`
2. Use enum constants instead of string literals
3. Write mobile-first, accessible UI
4. Add translations for new UI text
5. Test on both light and dark themes

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
