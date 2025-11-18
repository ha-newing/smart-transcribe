# Backend Enum Definitions

This document defines enums that must be consistent across frontend and backend.

## User Roles

**Backend (Go):**
```go
package types

type UserRole string

const (
    UserRoleSystemAdmin UserRole = "system_admin"
    UserRoleHRAdmin     UserRole = "hr_admin"
    UserRoleAssessor    UserRole = "assessor"
    UserRoleParticipant UserRole = "participant"
    UserRoleObserver    UserRole = "observer"
)

// AllUserRoles returns all valid user roles
func AllUserRoles() []UserRole {
    return []UserRole{
        UserRoleSystemAdmin,
        UserRoleHRAdmin,
        UserRoleAssessor,
        UserRoleParticipant,
        UserRoleObserver,
    }
}

// IsValid checks if a role is valid
func (r UserRole) IsValid() bool {
    for _, role := range AllUserRoles() {
        if r == role {
            return true
        }
    }
    return false
}

// IsAdmin checks if role has admin privileges
func (r UserRole) IsAdmin() bool {
    return r == UserRoleSystemAdmin || r == UserRoleHRAdmin
}
```

**Frontend (TypeScript):**
See: `frontend/src/types/roles.ts`

## Assessment Session Roles

**Backend (Go):**
```go
package types

type SessionRole string

const (
    SessionRoleFacilitator SessionRole = "facilitator"
    SessionRoleAssessor    SessionRole = "assessor"
    SessionRoleObserver    SessionRole = "observer"
)

func AllSessionRoles() []SessionRole {
    return []SessionRole{
        SessionRoleFacilitator,
        SessionRoleAssessor,
        SessionRoleObserver,
    }
}
```

**Frontend (TypeScript):**
```typescript
export const SessionRole = {
  FACILITATOR: 'facilitator',
  ASSESSOR: 'assessor',
  OBSERVER: 'observer',
} as const;

export type SessionRoleType = typeof SessionRole[keyof typeof SessionRole];
```

## Case Types

**Backend (Go):**
```go
package types

type CaseType string

const (
    CaseTypeInTray        CaseType = "in_tray"
    CaseTypeCaseStudy     CaseType = "case_study"
    CaseTypeRolePlay      CaseType = "role_play"
    CaseTypePresentation  CaseType = "presentation"
    CaseTypeGroupExercise CaseType = "group_exercise"
)

func AllCaseTypes() []CaseType {
    return []CaseType{
        CaseTypeInTray,
        CaseTypeCaseStudy,
        CaseTypeRolePlay,
        CaseTypePresentation,
        CaseTypeGroupExercise,
    }
}
```

## Status Enums

### Session Status
```go
type SessionStatus string

const (
    SessionStatusDraft      SessionStatus = "draft"
    SessionStatusScheduled  SessionStatus = "scheduled"
    SessionStatusInProgress SessionStatus = "in_progress"
    SessionStatusCompleted  SessionStatus = "completed"
    SessionStatusCancelled  SessionStatus = "cancelled"
)
```

### Assessment Status
```go
type AssessmentStatus string

const (
    AssessmentStatusPending    AssessmentStatus = "pending"
    AssessmentStatusInProgress AssessmentStatus = "in_progress"
    AssessmentStatusCompleted  AssessmentStatus = "completed"
    AssessmentStatusFinalized  AssessmentStatus = "finalized"
)
```

### Case Status
```go
type CaseStatus string

const (
    CaseStatusDraft     CaseStatus = "draft"
    CaseStatusActive    CaseStatus = "active"
    CaseStatusArchived  CaseStatus = "archived"
)
```

## Database Migration

When creating the database schema, use CHECK constraints to enforce enum values:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}',
    -- Add constraint to validate roles
    CONSTRAINT valid_roles CHECK (
        roles <@ ARRAY['system_admin', 'hr_admin', 'assessor', 'participant', 'observer']::TEXT[]
    )
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    CONSTRAINT valid_session_status CHECK (
        status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')
    )
);

-- Cases table
CREATE TABLE cases (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    CONSTRAINT valid_case_type CHECK (
        type IN ('in_tray', 'case_study', 'role_play', 'presentation', 'group_exercise')
    ),
    CONSTRAINT valid_case_status CHECK (
        status IN ('draft', 'active', 'archived')
    )
);
```

## Validation Rules

1. **Always use enum constants** - Never hardcode string values
2. **Validate on both frontend and backend** - Frontend for UX, backend for security
3. **Use TypeScript const assertions** - Ensures type safety
4. **Add database constraints** - Prevents invalid data at DB level
5. **Keep enums in sync** - Any changes must update frontend, backend, and database

## Testing

Each enum should have tests to ensure:
- All values are unique
- Validation functions work correctly
- Type safety is maintained
- Database constraints are enforced
