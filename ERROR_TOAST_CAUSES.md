# All Possible Causes of Red Error Toasts in the Portal

This document lists all possible causes of error toasts (red/destructive variant) across the entire portal.

## Authentication Page (`src/pages/Auth.tsx`)

1. **Invalid or expired password reset link** - When accessing password recovery with invalid/expired token
2. **Invalid email format** - Email validation fails (not a valid email format)
3. **Invalid password** - Password is less than 6 characters
4. **Passwords don't match** - Password and confirm password don't match during password recovery
5. **Password update error** - Error updating password during recovery
6. **Login failed** - Invalid email or password credentials
7. **General login error** - Other authentication errors during sign in
8. **Account already exists** - Email is already registered when trying to sign up
9. **Sign up error** - General error during account creation
10. **General error** - Catch-all error handler

## Accounts Page (`src/pages/Accounts.tsx`)

1. **Failed to load accounts** - Error fetching accounts list
2. **Failed to save account** - Error creating/updating account
3. **Validation Error** - Missing required fields (Account Name, Website, Address, Founded Year)
4. **Failed to parse CSV** - Error parsing uploaded CSV file
5. **Failed to upload accounts** - Error during bulk CSV upload
6. **Failed to export accounts** - Error exporting accounts to CSV
7. **Failed to delete account** - Error deleting an account
8. **Failed to update account** - Error updating account details
9. **Failed to load mandates** - Error fetching related mandates data

## Contacts Page (`src/pages/Contacts.tsx`)

1. **Failed to load contacts** - Error fetching contacts list
2. **Failed to save contact** - Error creating/updating contact
3. **Validation Error** - Missing required fields (Account, First Name, Last Name, Email, Phone Number)
4. **Failed to parse CSV** - Error parsing uploaded CSV file
5. **Failed to upload contacts** - Error during bulk CSV upload
6. **Failed to export contacts** - Error exporting contacts to CSV
7. **Failed to delete contact** - Error deleting a contact
8. **Failed to update contact** - Error updating contact details

## Mandates Page (`src/pages/Mandates.tsx`)

### General Operations
1. **Failed to save mandate** - Error creating/updating mandate
2. **Failed to load mandates** - Error fetching mandates list
3. **Failed to delete mandate** - Error deleting a mandate
4. **Failed to update mandate** - Error updating mandate details
5. **Failed to update mandate checker** - Error updating mandate checker section
6. **Failed to export mandates** - Error exporting mandates to CSV

### CSV Upload - Mandates Bulk Upload
7. **Failed to parse CSV** - Error parsing uploaded CSV file
8. **Failed to upload mandates** - Error during bulk CSV upload
9. **Validation Error** - CSV validation errors:
   - Account Name doesn't exist
   - KAM Name doesn't exist
   - Account Name is required
   - KAM Name is required
   - Project Code is required
   - Project Code is duplicated in CSV
   - Project Name is required
   - LoB (Vertical) is required
   - Type must be either 'New' or 'Existing'
   - Upsell Constraint Type is required when Upsell Constraint is YES
   - Upsell Constraint Type - Sub is required when Upsell Constraint is YES
   - Invalid Upsell Constraint Type - Sub 2

### CSV Upload - Bulk MCV Update
10. **Failed to parse CSV** - Error parsing MCV CSV file
11. **Failed to upload MCV data** - Error during bulk MCV upload
12. **Validation Error** - MCV CSV validation errors:
    - Project Code is required
    - Project Code doesn't exist in database
    - Month is required
    - Month must be a number between 1 and 12
    - Year is required
    - Year must be a valid year (2000-2100)
    - Planned MCV is required
    - Planned MCV must be a valid number >= 0
    - Achieved MCV is required
    - Achieved MCV must be a valid number >= 0

### Monthly Record
13. **Failed to save monthly record** - Error saving monthly MCV record
14. **Validation Error** - Monthly record validation errors

## Pipeline Page (`src/pages/Pipeline.tsx`)

### General Operations
1. **Failed to save deal** - Error creating/updating pipeline deal
2. **Failed to load deals** - Error fetching deals list
3. **Failed to delete deal** - Error deleting a deal
4. **Failed to update deal** - Error updating deal details
5. **Failed to update status** - Error updating deal status
6. **Failed to export deals** - Error exporting deals to CSV

### CSV Upload - Deals Bulk Upload
7. **Failed to parse CSV** - Error parsing uploaded CSV file
8. **Failed to upload deals** - Error during bulk CSV upload
9. **Upload Partially Failed** - Some deals failed to upload (partial success)
10. **Validation Error** - CSV validation errors:
    - Account Name doesn't exist
    - KAM Name doesn't exist
    - SPOC Name doesn't exist
    - SPOC 2 Name doesn't exist
    - SPOC 3 Name doesn't exist
    - Account Name is required
    - KAM Name is required
    - LoB is required
    - Invalid LoB (must be from predefined list)
    - Use Case should be blank for certain LoBs
    - Sub Use Case should be blank for certain LoBs
    - Invalid Use Case for selected LoB
    - Invalid Sub Use Case for selected Use Case
    - Monthly Volume must be a valid number >= 0
    - Max Monthly Volume must be a valid number >= 0
    - Commercial per head must be a valid number >= 0
    - Expected Revenue must be a valid number >= 0
    - PRJ duration must be between 1 and 12 months
    - GM Threshold must be a valid number >= 0
    - Invalid PRJ Frequency
    - Invalid Probability (must be 0-100)
    - Invalid Status

### Status Update
11. **Validation Error** - Status update validation errors (missing required fields for specific statuses)

## User Management (`src/pages/AdminUsers.tsx`)

1. **Failed to load users** - Error fetching users list
2. **Failed to send password reset link** - Error sending password reset email

## Invite User Dialog (`src/components/InviteUserDialog.tsx`)

1. **Validation Error** - Form validation errors (email, full name, role)
2. **Failed to invite user** - Error calling invite-user edge function or edge function returned error

## Edit User Dialog (`src/components/EditUserDialog.tsx`)

1. **Failed to update user role** - Error updating user role in database

## CSV Preview Dialog (`src/components/CSVPreviewDialog.tsx`)

- Shows validation errors in the preview (not as toast, but as inline errors)

## Common Error Patterns

### Database Errors
- RLS (Row Level Security) policy violations
- Foreign key constraint violations
- Unique constraint violations
- Network connectivity issues
- Database timeout errors

### Validation Errors
- Missing required fields
- Invalid data formats
- Data type mismatches
- Value out of allowed range
- Invalid enum values
- Duplicate values where unique required

### File Upload Errors
- Invalid CSV format
- File too large
- Unsupported file type
- Corrupted file
- Missing required columns

### Authentication Errors
- User not logged in
- Session expired
- Insufficient permissions
- Invalid credentials

### Edge Function Errors
- Function invocation failed
- Function returned error
- Network error calling edge function
- Timeout errors

## Notes

- Most error toasts include the actual error message from the database/API when available
- Some errors have generic fallback messages like "Please try again" or "Please check the format"
- Validation errors are typically more specific and user-friendly
- Database errors may expose technical details that should be logged but shown in user-friendly format




