# Credit System Analysis Report

## 1. Credit Logic Identification

### Backend Credit System

**File**: `backend/credit_service.py`
- **Core Functions**:
  - `get_available_credits(db, user_id)` - Calculate available credits (purchased - consumed)
  - `check_credits(db, user_id, required_credits)` - Check if user has sufficient credits
  - `deduct_credits_atomic(db, user_id, amount)` - Atomically deduct credits (thread-safe)
  - `add_credits(db, user_id, amount, transaction_type, reference_id)` - Add credits to user
  - `initialize_user_credits(db, user_id, plan)` - Initialize credits for new users
  - `get_credit_summary(db, user_id)` - Get comprehensive credit information
  - `refund_credits(db, user_id, amount, reference_id)` - Refund credits

**File**: `backend/main.py`
- **Endpoints**:
  - `GET /api/credits` - Get user credit balance (lines 2130-2190)
  - `POST /api/admin/credits/grant` - Admin endpoint to grant test credits (line 2941)
  - `POST /api/credits/add` - Add credits (line 2311)
  - `POST /api/credits/refund` - Refund credits (line 2365)
  - `POST /api/credits/initialize` - Initialize user credits (line 2402)
  - `POST /api/credits/redeem` - Redeem credits (line 3063)

### Frontend Credit System

**File**: `frontend/src/contexts/AccountContext.jsx`
- **Global Credit State Management**:
  - `credits` - Current available credits (fetched from `/api/credits`)
  - `refreshCredits()` - Function to manually refresh credits
  - Auto-refreshes every 30 seconds
  - Uses `fetch()` API directly (not `apiClient`)

**File**: `frontend/src/components/Dashboard.jsx`
- **Local Credit State**:
  - `userCredits` - Local state for credits (line 234)
  - `usedCredits` - Local state for used credits (line 235)
  - `fetchUserCredits()` - Function to fetch credits via `apiClient.get('/api/credits')` (line 304)
  - Called on component mount and after credit operations

**Other Files Using Credits**:
- `PaymentSuccess.jsx` - Polls `/api/credits` to detect credit increase after payment
- `Sidebar.jsx` - Displays credits from `AccountContext`
- `Settings.jsx` - Displays credits from `AccountContext`
- `SummaryCard.jsx` - Receives credits as props

---

## 2. Database Schema Check

### Current Profile Table Structure

**File**: `backend/models.py` (lines 70-105)

The `profiles` table uses a **two-column credit system**:
- `purchased_credits` (Integer, default=0, nullable=False) - Total purchased/granted credits
- `consumed_credits` (Integer, default=0, nullable=False) - Total consumed credits

**Available Credits Calculation**:
```python
available_credits = purchased_credits - consumed_credits
```

### SQL Migration (if needed)

If you need a single `credits` column instead of the two-column system, use:

```sql
-- Add single credits column (if not exists)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL;

-- Migrate existing data (if needed)
UPDATE profiles 
SET credits = GREATEST(0, purchased_credits - consumed_credits)
WHERE credits IS NULL OR credits = 0;
```

**Note**: The current two-column system is more robust as it tracks both purchased and consumed credits separately, allowing for better auditing and transaction history.

---

## 3. Test Credit Button Locations

### Identified Test Credit Components

**1. Dashboard.jsx** (Lines 2059-2121)
- **Location**: Below SummaryCard component
- **Condition**: `import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true'`
- **Function**: Grants 1000 test credits
- **Endpoint**: `POST /api/admin/credits/grant`
- **Button Text**: "🧪 Grant Test Credits +1000"
- **State**: `isToppingUp` (prevents duplicate clicks)

**2. Sidebar.jsx** (Lines 448-532)
- **Location**: Inside Credit Pack Modal
- **Condition**: `import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true'`
- **Function**: Grants 1000 test credits
- **Endpoint**: `POST /api/admin/credits/grant`
- **Button Text**: "🧪 Grant Test Credits (+1000)"
- **State**: `isGrantingTestCredits` (prevents duplicate clicks)
- **Features**: Shows success/error messages

**3. Settings.jsx** (Lines 327-348)
- **Location**: Inside Credits Card section
- **Condition**: `import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true'`
- **Function**: Grants 1000 test credits
- **Endpoint**: `POST /api/admin/credits/grant`
- **Button Text**: "🧪 Grant Test Credits (+1000)"
- **State**: `isGrantingCredits` (prevents duplicate clicks)
- **Features**: Shows success/error messages

### Common Characteristics

All test credit buttons:
- ✅ Protected by `VITE_ENABLE_TEST_CREDITS` environment variable
- ✅ Require `VITE_ADMIN_API_KEY` for backend authentication
- ✅ Grant exactly 1000 credits
- ✅ Call `/api/admin/credits/grant` endpoint
- ✅ Refresh credits after successful grant
- ✅ Show loading states during operation
- ✅ Handle errors gracefully

**Security Note**: These buttons are hidden by default and only shown when `VITE_ENABLE_TEST_CREDITS='true'` is explicitly set. The backend endpoint requires `ADMIN_API_KEY` for additional security.

---

## 4. Current Credit Fetch Flow

### Primary Flow: AccountContext (Global State)

**File**: `frontend/src/contexts/AccountContext.jsx`

**Flow**:
1. **Component Mount**: `useEffect` triggers `fetchCredits()` (line 89)
2. **API Call**: `GET /api/credits` using `fetch()` API (line 56)
   - Uses `API_BASE_URL` (empty string in production, relies on vercel.json proxy)
   - Includes credentials for JWT authentication
   - 30-second timeout with retry logic (3 retries, 2s delay)
3. **Response Handling**:
   - Sets `credits` state to `data.available_credits || 0` (line 68)
   - Sets `plan` state to `data.current_plan || 'FREE'` (line 69)
   - Sets `apiStatus` to 'connected' on success (line 70)
4. **Auto-Refresh**: `setInterval` refreshes every 30 seconds (line 91)
5. **Manual Refresh**: `refreshCredits` function exposed to components

**Used By**:
- `Sidebar.jsx` - Displays credits in Credit Pack Modal
- `Settings.jsx` - Displays credits in Credits Card
- `Pricing.jsx` - Displays current credits

### Secondary Flow: Dashboard Local State

**File**: `frontend/src/components/Dashboard.jsx`

**Flow**:
1. **Function**: `fetchUserCredits()` (line 304)
2. **API Call**: `GET /api/credits` using `apiClient` (line 314)
   - Uses `apiClient` which goes directly to Railway in production
   - Includes JWT token automatically via interceptor
   - 60-second timeout
3. **Response Handling**:
   - Sets `userCredits` to `response.data.available_credits || 0` (line 318)
   - Sets `usedCredits` to `response.data.used_credits || 0` (line 319)
   - Sets `userPlan` to `response.data.plan || 'FREE'` (line 320)
4. **Called When**:
   - Component mount (via `useEffect`)
   - After sync operations (line 1406)
   - After OAuth connection (line 1642)
   - After store connection (line 1698)
   - After test credit grant (line 2099)

**Used By**:
- `SummaryCard` component - Displays credits
- `ConfirmModal` - Shows required vs available credits
- Analysis operations - Checks credits before execution

### Backend Credit Fetch Endpoint

**File**: `backend/main.py` (lines 2130-2190)

**Endpoint**: `GET /api/credits`

**Flow**:
1. **Authentication**: Extracts `user_id` from JWT token (via `get_current_user`)
2. **Credit Summary**: Calls `get_credit_summary(db, user_id)` from `credit_service.py`
3. **Profile Check**: If profile doesn't exist, auto-creates with `initialize_user_credits()`
4. **Response**: Returns `CreditBalanceResponse` with:
   - `purchased_credits` - Total purchased/granted credits
   - `consumed_credits` - Total consumed credits
   - `available_credits` - Calculated as `purchased_credits - consumed_credits`
   - `current_plan` - User's current plan (free, starter, pro, enterprise)
   - `free_tier_count` - Number of free tier uses
   - `free_tier_remaining` - Remaining free tier uses

**Credit Calculation**:
```python
available_credits = max(0, profile.purchased_credits - profile.consumed_credits)
```

---

## Summary

### Credit System Architecture

**Database**:
- ✅ Two-column system: `purchased_credits` and `consumed_credits`
- ✅ Available credits = `purchased_credits - consumed_credits`
- ✅ No single `credits` column needed (calculated field)

**Frontend**:
- ✅ Global state: `AccountContext` (auto-refreshes every 30s)
- ✅ Local state: `Dashboard` component (refreshes on demand)
- ✅ Both use `/api/credits` endpoint

**Test Credit Buttons**:
- ✅ 3 locations: Dashboard, Sidebar, Settings
- ✅ All protected by `VITE_ENABLE_TEST_CREDITS` environment variable
- ✅ All require `VITE_ADMIN_API_KEY` for backend authentication
- ✅ All grant 1000 credits via `/api/admin/credits/grant`

**Current Flow**:
1. User opens app → `AccountContext` fetches credits on mount
2. Credits auto-refresh every 30 seconds
3. Dashboard also fetches credits independently for local state
4. After operations (sync, analysis), credits are refreshed manually
5. Test credit buttons allow dev/admin to grant credits for testing
