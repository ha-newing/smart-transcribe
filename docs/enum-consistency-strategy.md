# Enum Consistency Strategy: Single Source of Truth

## Problem

When working with enums/constants across different parts of the stack (Frontend, Convex, Backend, Database), maintaining consistency is critical. String literals lead to:
- ❌ Typos that aren't caught until runtime
- ❌ Different values in different places
- ❌ No autocomplete or type safety
- ❌ Difficult refactoring

## Solution: Shared Constants File

We use a **single source of truth** approach with shared TypeScript constants.

### Architecture

```
┌─────────────────────────────────────────────────┐
│   /frontend/src/constants/enums.ts              │
│   SINGLE SOURCE OF TRUTH                         │
│   - All enum values defined once                 │
│   - TypeScript const assertions                  │
│   - Exported constants and types                 │
└─────────────────┬───────────────────────────────┘
                  │
          ┌───────┴────────┐
          │                │
          ▼                ▼
┌──────────────────┐  ┌──────────────────┐
│  Frontend (src/) │  │  Convex (convex/)│
│  - React         │  │  - Schema        │
│  - Services      │  │  - Functions     │
│  - Components    │  │  - Validators    │
└──────────────────┘  └──────────────────┘
          │                │
          └───────┬────────┘
                  ▼
        ┌──────────────────┐
        │  Backend (Go)    │
        │  Must match!     │
        └──────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │  Database        │
        │  CHECK           │
        │  constraints     │
        └──────────────────┘
```

## Implementation

### 1. Shared Constants (`/frontend/src/constants/enums.ts`)

```typescript
export const USER_ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  HR_ADMIN: 'hr_admin',
  ASSESSOR: 'assessor',
  PARTICIPANT: 'participant',
  OBSERVER: 'observer',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export const ALL_USER_ROLES = Object.values(USER_ROLES);
```

**Benefits:**
- ✅ One place to update
- ✅ TypeScript type checking
- ✅ Can be imported by both `src/` and `convex/`

### 2. Frontend Types Re-export (`/frontend/src/types/roles.ts`)

```typescript
import { USER_ROLES, type UserRole as UserRoleEnum } from '@/constants/enums';

// Re-export for convenience
export const UserRole = USER_ROLES;
export type UserRoleType = UserRoleEnum;

// Add UI helpers
export const UserRoleLabels: Record<UserRoleType, string> = {
  [UserRole.SYSTEM_ADMIN]: 'System Administrator',
  // ...
};
```

**Purpose:**
- Keep existing import paths working
- Add UI-specific helpers (labels, descriptions)
- Maintain separation of concerns

### 3. Convex Schema (`/frontend/convex/schema.ts`)

```typescript
import { ALL_USER_ROLES } from "../src/constants/enums";

// Dynamically generate union from shared constants
export const roles = v.union(
  ...ALL_USER_ROLES.map((role) => v.literal(role))
);
```

**Benefits:**
- ✅ Schema automatically stays in sync
- ✅ Add new role → automatically included in validation
- ✅ No manual updates needed

### 4. Convex Functions (`/frontend/convex/users.ts`)

```typescript
import { USER_ROLES } from "../src/constants/enums";
import { roles } from "./schema";

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: roles, // Uses shared schema definition
  },
  handler: async (ctx, args) => {
    // Use constants, not strings
    if (user?.email === "ha@newing.vn") {
      return USER_ROLES.SYSTEM_ADMIN; // ✅ Type-safe
    }
  },
});
```

### 5. Backend Go (Must Match)

**File:** `/backend/internal/types/roles.go`

```go
package types

type UserRole string

const (
    UserRoleSystemAdmin UserRole = "system_admin" // Must match frontend!
    UserRoleHRAdmin     UserRole = "hr_admin"
    UserRoleAssessor    UserRole = "assessor"
    UserRoleParticipant UserRole = "participant"
    UserRoleObserver    UserRole = "observer"
)
```

**Validation:**
```go
func (r UserRole) IsValid() bool {
    validRoles := []UserRole{
        UserRoleSystemAdmin,
        UserRoleHRAdmin,
        UserRoleAssessor,
        UserRoleParticipant,
        UserRoleObserver,
    }
    for _, valid := range validRoles {
        if r == valid {
            return true
        }
    }
    return false
}
```

### 6. Database Constraints

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}',

    -- Enforce enum values at database level
    CONSTRAINT valid_user_roles CHECK (
        roles <@ ARRAY[
            'system_admin',
            'hr_admin',
            'assessor',
            'participant',
            'observer'
        ]::TEXT[]
    )
);
```

## Usage Examples

### ✅ Correct Usage

```typescript
// Frontend components
import { UserRole } from '@/types/roles';

if (user.roles.includes(UserRole.SYSTEM_ADMIN)) {
  // Type-safe, autocomplete works
}

// Convex functions
import { USER_ROLES } from "../src/constants/enums";

const role = USER_ROLES.HR_ADMIN; // ✅ Constants

// Backend
if user.Role == types.UserRoleSystemAdmin {
    // Type-safe
}
```

### ❌ Incorrect Usage

```typescript
// DON'T use string literals
if (user.roles.includes('system_admin')) { // ❌ No type safety
  // Typos possible: 'system_admn', 'SYSTEM_ADMIN', etc.
}

// DON'T hardcode in Convex
const role = 'HR_ADMIN'; // ❌ Won't match frontend

// DON'T use strings in Go
if user.Role == "system_admin" { // ❌ Use const instead
}
```

## Adding a New Enum Value

1. **Update shared constants** (`/frontend/src/constants/enums.ts`)
   ```typescript
   export const USER_ROLES = {
     // ... existing
     NEW_ROLE: 'new_role', // Add here
   } as const;
   ```

2. **Convex schema automatically updates** (no changes needed!)

3. **Add translation keys** (`/frontend/src/i18n/locales/*.json`)
   ```json
   {
     "roles": {
       "new_role": "New Role"
     }
   }
   ```

4. **Update backend** (`/backend/internal/types/roles.go`)
   ```go
   const (
       // ... existing
       UserRoleNewRole UserRole = "new_role"
   )
   ```

5. **Update database constraint** (via migration)
   ```sql
   ALTER TABLE users DROP CONSTRAINT valid_user_roles;
   ALTER TABLE users ADD CONSTRAINT valid_user_roles CHECK (
       roles <@ ARRAY[
           'system_admin',
           'hr_admin',
           'assessor',
           'participant',
           'observer',
           'new_role'  -- Add here
       ]::TEXT[]
   );
   ```

## Benefits

### Type Safety
- ✅ TypeScript catches invalid values at compile time
- ✅ Autocomplete in IDE for all values
- ✅ Refactoring is safe (rename symbol works)

### Consistency
- ✅ Frontend and Convex share exact same values
- ✅ Backend validation uses matching constants
- ✅ Database constraints enforce at data layer

### Maintainability
- ✅ One place to add new values
- ✅ Convex schema auto-updates
- ✅ Clear documentation path

### Developer Experience
- ✅ No guessing correct string values
- ✅ IDE autocomplete everywhere
- ✅ Compile-time errors instead of runtime bugs

## Testing Strategy

### Frontend
```typescript
import { USER_ROLES, isValidUserRole } from '@/constants/enums';

describe('UserRole enums', () => {
  it('has no duplicate values', () => {
    const values = Object.values(USER_ROLES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('validates correctly', () => {
    expect(isValidUserRole('system_admin')).toBe(true);
    expect(isValidUserRole('invalid')).toBe(false);
  });
});
```

### Backend
```go
func TestUserRoleValidation(t *testing.T) {
    valid := types.UserRoleSystemAdmin
    if !valid.IsValid() {
        t.Error("Valid role marked as invalid")
    }

    invalid := types.UserRole("fake_role")
    if invalid.IsValid() {
        t.Error("Invalid role marked as valid")
    }
}
```

## Summary

| Layer | Location | Implementation |
|-------|----------|----------------|
| **Source of Truth** | `/frontend/src/constants/enums.ts` | TypeScript const objects |
| **Frontend Types** | `/frontend/src/types/*.ts` | Re-exports + UI helpers |
| **Convex Schema** | `/frontend/convex/schema.ts` | Dynamic `v.union()` from constants |
| **Convex Functions** | `/frontend/convex/*.ts` | Import shared constants |
| **Backend** | `/backend/internal/types/*.go` | Matching Go constants |
| **Database** | Migration files | CHECK constraints |
| **Translations** | `/frontend/src/i18n/locales/*.json` | i18n keys match enum values |

This strategy ensures **end-to-end consistency** with **minimal duplication** and **maximum type safety**.
