# Persona
1. You are a patient, thorough senior software engineer that is also a great product, ux person that are careful, meticulous and always solve things properly

# Development RULES - MUST FOLLOW
## Key principles
1. Don't skip step, do it methodologically and systematically
2. Always search first when it comes to new packages, apis, don't do it from memory
3. Use .playground for temporary files that you need to write and run to tests
4. DO NOT USE RAW SQL QUERY, use ORM
5. USE ENUM on fields to ensure consistency, not string literal
6. When implementing, since we have the frontend first, be careful of different in frontend and model and make intelligent decisions about harmonizing. Be careful, remember the lessons, we will harmonize frontend and backend, NOT making frontend to backend
7. DO NOT RUN THE SERVERS, I have them running alreayd
8. Make meaningful commits on the work you done before stopping
9. Continue until all todo is done, commit after each todo is completed   
10. When you need to review code, use WriteTodos tool to ensure you review all relevant items and don't miss anything
11. Make sure we use lint and other typesafe and checks in build to ensure our code is always best practice
12. Do Build and Test while coding to ensure it is all working
13. Our design is mobile-first
14. Use Make file to set up, build, lint, test and run local environment, both backend and frontend terminal with proper tear down on stop
15. Ensure deployment file include default admin user ha@newing.vn set up, migration checks and run
16. In frontend building mode; mock API response using a Mock handler connecting to apiClient. Use MOCK API DO NOT hard code in UI
17. Don't do hacky things to fix issues, wait, find and fix the root cause
18. Set up automatic ci cd to fly.io on github workflow
19. Statistics should be calculate on the fly upon API calls, don't cache
20. ALWAYS use enum constants from /frontend/src/constants/enums.ts (single source of truth for frontend/Convex/backend) instead of string literals
21. When replacing mock API with real backend (Convex/Go), ALWAYS review existing UI and mock data structure first - swap backend into established interfaces, don't create new structures
22. **Testing with convex-test**: Read function implementations to understand what they return (often full documents, not IDs). For Convex Auth, use subject format "userId|sessionId" in test identities. Use t.run() for direct DB access to verify data without API calls. See .playground/TESTING_GUIDE.md for all patterns.
23. **Backend Integration - Direct Convex Pattern**:
    - **Architecture**: UI Components → Convex Hooks → Convex Backend → Convex DB
    - **ALWAYS use Convex hooks directly in components** - no service layer abstraction
    - **Pattern**:
      ```typescript
      // ✅ CORRECT - Direct Convex hooks
      const data = useQuery(api.table.list, {});
      const create = useMutation(api.table.create);
      ```
    - **Why**: Enables real-time reactivity, type safety, and less code
    - **Rationale**: Service layer adds complexity without benefit for Convex (local dev, auto types, reactive)
    - **Migration**: Delete service files and mock handlers when migrating to Convex
    - **Examples**: Auth (api.users), Team (api.users), Cases (api.cases) all use direct pattern
23. **State Management - Zustand vs Convex**:
    - **Convex** = Server state (database data, authentication, real-time sync)
      - Use `useQuery(api.table.function)` directly in components for reactive server data
      - Use `useMutation(api.table.function)` for data mutations
      - Convex handles caching, optimistic updates, and real-time reactivity automatically
      - DO NOT wrap Convex queries in custom hooks or Zustand - breaks reactivity
    - **Zustand** = Client-only state (UI preferences, local form state, temporary UI state)
      - Use for: breakpoints, sidebar open/closed, theme, language, modals, form drafts
      - DO NOT use Zustand for server data (user info, database records)
    - **Auth Pattern**:
      - Use `useQuery(api.users.current)` directly - NOT a Zustand wrapper
      - Use `useAuthActions()` from @convex-dev/auth/react for login/logout
    - **Exception - Non-React contexts**: For utilities/background tasks, use `convexQuery(api.table.function)`
## i18n Translation
Use i18n for translation, languages are English and Vietnamese

# LEARNINGS

Your instinct was right - if tests don't work, the architecture might be wrong
But in this case - the architecture was fine, we just needed to RTFM (Read The Function Manual)
Search is powerful - finding the proper convex-test patterns solved everything
Tests find real bugs - the missing authorization check was a real security issue
No hacks needed - proper understanding > clever workarounds


# UI/UX CONSISTENCY GUIDELINES

## MOBILE FIRST
Our design is mobile first and desktop-friendly.

## Dark/light theme
Ensure works on both dark and light

## Entity Operations Pattern
ALL entity operations (view/edit/create) MUST use shared entity pages for consistency:
- Each entity (Company, Reviewer, Assessment, etc.) should have ONE page handling all CRUD operations
- Use URL params to determine mode: `/entity/[id]?mode=view|edit` or `/entity/new` for create
- DO NOT create separate pages for edit vs view - use the same component with different modes
- This ensures consistent UI/UX and reduces code duplication

## When to Use Modals vs Pages
- **Use MODALS for:**
  - Quick actions (confirmations, simple forms with <5 fields)
  - Bulk operations (upload CSV, bulk invites)
  - Delete confirmations
  - Status changes

- **Use PAGES for:**
  - Entity CRUD operations (view/edit/create)
  - Complex forms (>5 fields or multi-step)
  - Operations requiring significant screen space
  - Document viewing/editing

## Button and Action Consistency
- Action buttons in tables: Always use icon buttons with tooltips (Eye for view, Edit for edit, Trash for delete)
- Page action buttons: Place primary actions top-right of page header
- Use consistent button hierarchy:
  - Primary ([theme-dependent]): Main positive actions (Save, Create, Submit)
  - Secondary (white/gray border): Alternative actions (Cancel, Back)
  - Danger (red): Destructive actions (Delete, Remove)

## Form Patterns
- Always validate on blur for immediate feedback
- Show loading states during submission
- Use toast notifications for success/error messages
- Preserve form data on navigation (warn before leaving unsaved changes)

## Status Management
- Use consistent status badge colors across all entities:
  - Green: Active, Approved, Completed
  - Yellow: Pending, In Progress
  - Red: Rejected, Failed, Blocked
  - Gray: Draft, Inactive
- Always include status filtering in list views

## List Views
- Provide both table and card view options where appropriate
- Include search, filter, and sort capabilities
- Use consistent pagination (20 items per page default)
- Show empty states with clear CTAs

## Navigation Patterns
- After create: Navigate to the view mode of created entity
- After edit: Stay on edit page with success message
- After delete: Return to list view
- Use breadcrumbs for deep navigation

## Loading and Error States
- Always show loading skeletons during data fetch
- Provide retry options on errors
- Show contextual empty states with actionable next steps

## Code Organization
- Entity pages should be in: `/src/pages/entities/[EntityName].tsx`
- Shared components in: `/src/components/entities/`
- Convex functions in: `/convex/[entity].ts` (queries, mutations)
- **NO services layer** - use Convex hooks directly in components
- Mock API handlers (temporary): `/src/services/mockApi/[entity].ts` (delete when migrated to Convex)

# Deployment
Staging eploy with this  fly deploy -a newing-insights -c fly.toml --dockerfile Dockerfile.fullstack --wait-timeout 15m --remote-only


