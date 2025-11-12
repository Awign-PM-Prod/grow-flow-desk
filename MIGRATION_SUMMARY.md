# Migration Summary: user_roles table → profiles.role column

## Overview
The `user_roles` table has been removed from the database and replaced with a `role` column in the `profiles` table. This document lists all places where the codebase was interacting with the `user_roles` table and what changes were made.

## Database Schema Changes
- **Removed**: `public.user_roles` table
- **Added**: `role` column to `public.profiles` table (type: `app_role | null`)

## Files Updated

### 1. Frontend Components

#### `src/pages/AdminUsers.tsx`
**Before**: 
- Fetched profiles and roles separately
- Joined data from `user_roles` table

**After**:
- Fetches `role` directly from `profiles` table in a single query
- Removed separate query to `user_roles` table

**Changes**:
- Updated query to include `role` in profiles select: `.select("id, email, full_name, created_at, role")`
- Removed separate `user_roles` query
- Simplified data mapping to use `profile.role` directly

---

#### `src/components/EditUserDialog.tsx`
**Before**:
- Deleted old role from `user_roles` table
- Inserted new role into `user_roles` table

**After**:
- Updates `role` column directly in `profiles` table

**Changes**:
- Replaced delete + insert operations with single `update` operation on `profiles` table
- Changed from `.from("user_roles")` to `.from("profiles")`
- Changed from `.eq("user_id", user.id)` to `.eq("id", user.id)`

---

#### `src/hooks/useAuth.tsx`
**Before**:
- Fetched roles from `user_roles` table
- Returned array of roles (supporting multiple roles per user)

**After**:
- Fetches `role` from `profiles` table
- Returns single role as array for backward compatibility

**Changes**:
- Updated query from `.from("user_roles")` to `.from("profiles")`
- Changed from `.eq("user_id", userId)` to `.eq("id", userId).single()`
- Converted single role value to array format: `[data.role as UserRole]` for compatibility with existing code

---

### 2. Edge Functions

#### `supabase/functions/invite-user/index.ts`
**Before**:
- Checked superadmin role by querying `user_roles` table
- Inserted role into `user_roles` table after user creation

**After**:
- Checks superadmin role from `profiles.role`
- Updates `profiles.role` after user creation

**Changes**:
- Line 51-55: Changed role check from `user_roles` to `profiles` table
- Line 100-105: Changed role assignment from `insert` into `user_roles` to `update` on `profiles` table

---

#### `supabase/functions/send-password-reset/index.ts`
**Before**:
- Checked superadmin role by querying `user_roles` table

**After**:
- Checks superadmin role from `profiles.role`

**Changes**:
- Line 50-54: Changed role check from `user_roles` to `profiles` table

---

### 3. Type Definitions

#### `src/integrations/supabase/types.ts`
**Before**:
- Had separate type definitions for `user_roles` table
- `profiles` table did not include `role` column

**After**:
- Removed `user_roles` table type definitions
- Added `role` column to `profiles` table types (nullable)

**Changes**:
- Added `role: Database["public"]["Enums"]["app_role"] | null` to profiles Row, Insert, and Update types
- Removed entire `user_roles` table definition

---

### 4. Database Functions & Migrations

#### `supabase/migrations/20251112000000_update_has_role_function.sql` (NEW)
**Purpose**: Update the `has_role` function to use `profiles.role` instead of `user_roles` table

**Changes**:
- Updated `has_role` function to query `profiles` table instead of `user_roles`
- Changed WHERE clause from `user_id = _user_id` to `id = _user_id`
- This function is used in RLS policies, so updating it ensures policies continue to work

---

#### `supabase/migrations/20251111084716_00baae66-a7a6-46a8-8da2-79af217adad1.sql` (HISTORICAL)
**Note**: This is the original migration that created the `user_roles` table. It should remain as-is for historical reference, but the following parts are now obsolete:
- Lines 17-24: `user_roles` table creation
- Lines 26-27: RLS enablement for `user_roles`
- Lines 30-43: Original `has_role` function (now updated in new migration)
- Lines 77-96: RLS policies for `user_roles` table (can be dropped if table is deleted)

---

## Database Cleanup Required

After applying the code changes, you should run the following SQL to clean up the database:

```sql
-- Drop RLS policies for user_roles table (if they still exist)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "SuperAdmins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "SuperAdmins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "SuperAdmins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "SuperAdmins can delete roles" ON public.user_roles;

-- Drop the user_roles table (if it still exists)
DROP TABLE IF EXISTS public.user_roles;

-- Note: The has_role function is already updated by the migration file
```

## Summary of All Interactions with user_roles Table

### Queries (SELECT)
1. ✅ `src/pages/AdminUsers.tsx` - Fetched all user roles
2. ✅ `src/hooks/useAuth.tsx` - Fetched current user's roles
3. ✅ `supabase/functions/invite-user/index.ts` - Checked if user is superadmin
4. ✅ `supabase/functions/send-password-reset/index.ts` - Checked if user is superadmin

### Inserts (INSERT)
1. ✅ `src/components/EditUserDialog.tsx` - Inserted new role after deleting old one
2. ✅ `supabase/functions/invite-user/index.ts` - Inserted role for newly created user

### Updates (UPDATE)
1. ✅ `src/components/EditUserDialog.tsx` - Now updates profiles.role directly

### Deletes (DELETE)
1. ✅ `src/components/EditUserDialog.tsx` - Deleted old role before inserting new one (now just updates)

### Database Functions
1. ✅ `has_role()` function - Updated to query profiles table

### RLS Policies
1. ⚠️ RLS policies on `user_roles` table - Should be dropped when table is deleted (see cleanup SQL above)

## Testing Checklist

- [ ] Verify user role fetching works in AdminUsers page
- [ ] Verify role editing works in EditUserDialog
- [ ] Verify authentication and role checks work in useAuth hook
- [ ] Verify user invitation flow works (invite-user function)
- [ ] Verify password reset flow works (send-password-reset function)
- [ ] Verify RLS policies still work correctly with updated has_role function
- [ ] Verify all role-based access controls work (sidebar, protected routes, etc.)

## Notes

- The `useAuth` hook still returns `userRoles` as an array for backward compatibility, even though each user now has only one role
- The `has_role` function signature remains the same, so existing RLS policies continue to work
- All type definitions have been updated to reflect the new schema


