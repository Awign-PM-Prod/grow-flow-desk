# Mandates.html Analysis

## Overview
The `Mandates.html` file is a comprehensive wireframe/mockup for a Mandates management system with two main views: **Add Mandate Form** and **View Mandates Table**. It includes detailed form fields, filtering capabilities, and a modal for viewing mandate details.

## Structure Analysis

### 1. Main Navigation
- **Two tabs**: "Add Mandate" and "View Mandates"
- Tab switching functionality implemented with JavaScript
- Default view: Add Mandate form

### 2. Add Mandate Form (`pageMandateForm`)

The form is divided into **5 main sections**:

#### A. Project Info
**Fields:**
- `Project Code` (text, required) *
- `Project Name` (text, required) *
- `Account Name` (select dropdown, required) *
  - Options: "Dummy Account"
- `KAM (CE in charge)` (select dropdown, required) *
  - Options: "John KAM"
- `LoB (Vertical)` (select dropdown, required) *
  - Options: "LM", "Audit"

#### B. Handover Info (from Demand Team)
**Fields:**
- `New Sales Owner` (text, optional)
- `Monthly Volume` (number, required) *
- `Commercial per head/task` (number, required) *
- `MCV` (text, readonly, auto-calculated, required) *
  - Placeholder: "Auto"
- `PRJ duration in months` (number, required) *
  - Helper text: "How many months of PRJ in the next 12 months (1–12)"
- `ACV` (number, required) *
- `PRJ Type` (select dropdown, required) *
  - Options: "Recurring", "One-time"

#### C. Revenue Info (to be updated by KAM)
**Fields:**
- `Monthly Volume` (number, required) *
- `Commercial per head/task` (number, required) *
- `MCV` (text, readonly, auto-calculated, required) *
  - Placeholder: "Auto"
- `ACV` (number, required) *
- `PRJ Type` (select dropdown, required) *

**Note:** This section appears to be a duplicate of Handover Info but is meant to be updated by KAM separately.

#### D. Mandate Checker
**Fields:**
- `Mandate Health` (select dropdown, required) *
  - Options: "Exceeds Expectations", "Meets Expectations", "Need Improvement"
- `Upsell Constraint` (select dropdown, required) *
  - Options: "YES", "NO"
- `Upsell Constraint Type` (select dropdown, required) *
  - Options: "-", "Internal", "External"
- `Upsell Constraint Type - Sub` (select dropdown, required) *
  - Options: "Profitability", "Delivery", "Others"
- `Upsell Constraint Type - Sub 2` (select dropdown, required) *
  - Options: "GM too Low", "CoC (Cost of Capital too high)", "Schedule too tight"
- `Client Budget Trend` (select dropdown, required) *
  - Options: "Increase", "Same", "Decrease"
- `Awign Share %` (select dropdown, required) *
  - Options: "Below 70%", "70% & Above"
- `Retention Type (Automatically)` (text, readonly, auto-calculated)
  - Placeholder: "Star"

#### E. Upsell Action Status
**Fields:**
- `Status` (select dropdown)
  - Options: "Not Started", "Ongoing", "Done"

**Action Button:**
- "Save Mandate" button at the bottom

---

### 3. View Mandates Table (`pageMandateView`)

#### Filters Section
**Filter Options:**
- Search input: "Search by Project / Account / KAM"
- `LoB` dropdown: "All LoB", "Vertical Sample"
- `Mandate Health` dropdown: "All Mandate Health", "Exceeds Expectations", "Meets Expectations", "Need Improvement"
- `Upsell Status` dropdown: "All Upsell Status", "Not Started", "Ongoing", "Done"
- "Clear Filters" button

#### Table Columns
1. Project Code
2. Project Name
3. Account
4. KAM
5. LoB
6. ACV
7. MCV
8. Mandate Health
9. Upsell Status
10. Actions (View Details button)

#### Sample Data
- **PRJ-0001**: Mikasa Audit
  - Account: Dummy Account
  - KAM: John KAM
  - LoB: Vertical Sample
  - ACV: 12,00,000
  - MCV: 1,00,000
  - Mandate Health: Meets Expectations
  - Upsell Status: Ongoing

- **PRJ-0002**: Greenlam Rollout
  - Account: Dummy Account
  - KAM: Jane KAM
  - LoB: Vertical Sample
  - ACV: 24,00,000
  - MCV: 2,00,000
  - Mandate Health: Exceeds Expectations
  - Upsell Status: Not Started

---

### 4. Mandate Details Modal

**Modal Structure:**
- Full-width modal overlay
- Displays all mandate information in sections:
  1. **Project Info**
     - Project Code, Project Name, Account Name, KAM, LoB
  2. **Handover Info**
     - New Sales Owner, MCV, Monthly Volume, Commercial per head/task, PRJ duration, ACV, PRJ Type
  3. **Revenue Info (KAM)**
     - MCV, Monthly Volume, Commercial per head/task, ACV, PRJ Type
  4. **Mandate Checker**
     - Mandate Health, Upsell Constraint, Upsell Constraint Type, Sub types, Client Budget Trend, Awign Share %, Retention Type
  5. **Upsell Action Status**
     - Status

---

## Key Features Identified

### 1. Auto-Calculated Fields
- **MCV** (in both Handover Info and Revenue Info sections)
- **Retention Type** (in Mandate Checker section)

### 2. Conditional Logic (Implied)
- `Upsell Constraint Type - Sub` and `Sub 2` likely depend on `Upsell Constraint` being "YES"
- `Retention Type` appears to be automatically calculated based on other fields

### 3. Data Relationships
- **Account** → Linked to accounts table
- **KAM** → Linked to users/profiles table (users with KAM role)
- **LoB (Vertical)** → Line of Business/Vertical classification
- **Project Code** → Unique identifier (format: PRJ-XXXX)

### 4. Business Logic
- **MCV** = Monthly Contract Value (calculated from Monthly Volume × Commercial per head/task)
- **ACV** = Annual Contract Value
- **PRJ duration** = Project duration in months (1-12 months)
- **Retention Type** = Automatically determined (e.g., "Star" based on certain criteria)

---

## Technical Implementation Notes

### Form Validation
- Many fields marked with `*` (required)
- Number inputs for financial/volume fields
- Readonly fields for auto-calculated values

### UI/UX Features
- Responsive grid layout (1 column on mobile, 2 columns on desktop)
- Tab-based navigation
- Modal for detailed view
- Filterable table
- Search functionality

### Styling
- Uses Tailwind CSS (via CDN)
- Custom styles for number input spinners
- Table wrapper with overflow for horizontal scrolling

---

## Database Schema Requirements

Based on the form structure, you'll need a `mandates` table with the following fields:

### Core Fields
- `id` (UUID, primary key)
- `project_code` (text, unique)
- `project_name` (text)
- `account_id` (UUID, foreign key to accounts)
- `kam_id` (UUID, foreign key to profiles)
- `lob` (text/enum)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Handover Info Fields
- `new_sales_owner` (text, nullable)
- `handover_monthly_volume` (numeric)
- `handover_commercial_per_head` (numeric)
- `handover_mcv` (numeric, calculated)
- `prj_duration_months` (integer, 1-12)
- `handover_acv` (numeric)
- `handover_prj_type` (enum: 'Recurring', 'One-time')

### Revenue Info Fields (KAM Updated)
- `revenue_monthly_volume` (numeric)
- `revenue_commercial_per_head` (numeric)
- `revenue_mcv` (numeric, calculated)
- `revenue_acv` (numeric)
- `revenue_prj_type` (enum: 'Recurring', 'One-time')

### Mandate Checker Fields
- `mandate_health` (enum: 'Exceeds Expectations', 'Meets Expectations', 'Need Improvement')
- `upsell_constraint` (boolean)
- `upsell_constraint_type` (enum: 'Internal', 'External', null)
- `upsell_constraint_sub` (enum: 'Profitability', 'Delivery', 'Others', null)
- `upsell_constraint_sub2` (text, nullable)
- `client_budget_trend` (enum: 'Increase', 'Same', 'Decrease')
- `awign_share_percent` (enum: 'Below 70%', '70% & Above')
- `retention_type` (text, auto-calculated)

### Upsell Action Status
- `upsell_action_status` (enum: 'Not Started', 'Ongoing', 'Done')

---

## Integration Points

### 1. Accounts Integration
- Need to fetch accounts for the "Account Name" dropdown
- Link mandates to accounts

### 2. Users/Profiles Integration
- Need to fetch users with KAM role for "KAM (CE in charge)" dropdown
- Filter profiles by role = 'kam'

### 3. Calculations
- **MCV Calculation**: `MCV = Monthly Volume × Commercial per head/task`
- **Retention Type**: Logic needs to be defined (possibly based on Awign Share %, Mandate Health, etc.)

### 4. RLS Policies
- KAMs should see their own mandates
- Managers/Leadership should see team mandates
- Superadmins should see all mandates

---

## Comparison with Current Mandates.tsx

### Current Implementation
- Basic table view only
- Simple search functionality
- Dummy data with different structure
- No form for adding mandates
- No detailed view modal

### Required Updates
1. **Add two-tab navigation** (Add Mandate / View Mandates)
2. **Implement comprehensive form** with all 5 sections
3. **Add filters** to the table view
4. **Implement modal** for detailed view
5. **Add database integration** for CRUD operations
6. **Implement auto-calculations** for MCV and Retention Type
7. **Add form validation**
8. **Integrate with Accounts and Users tables**

---

## Next Steps

1. Create database migration for `mandates` table
2. Update `Mandates.tsx` component to match HTML structure
3. Create form components for each section
4. Implement auto-calculation logic
5. Add API endpoints/hooks for CRUD operations
6. Implement filtering and search functionality
7. Add RLS policies for data access control
8. Integrate with Accounts and Users dropdowns


