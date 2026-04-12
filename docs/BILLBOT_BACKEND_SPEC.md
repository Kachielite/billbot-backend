# BillBot — Backend Specification

## What We Are Building

BillBot is a shared expense splitting and settlement platform targeting African users who manage communal financial obligations (commonly known as "black tax") — such as family bills, rent, school fees, and group trips.

Users belong to groups. Within each group, they create **expense pools** (e.g. "Monthly Family Bills", "Trip to Paris", "Kofi's Wedding"). All expenses are logged inside a pool, splits are calculated among pool members, and settlements are confirmed manually — the payer uploads a proof of payment receipt, and the payee confirms receipt before the balance is marked settled.

The backend exposes a REST API consumed by a React Native mobile app. It also fires outbound webhooks to notify subscribers of key events (new member, new expense, settlement, etc).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express.js |
| Database | PostgreSQL (hosted on Supabase) |
| ORM | pg (raw SQL with prepared statements) or Prisma |
| File Storage | Supabase Storage (receipt images + settlement proof images) |
| AI | OpenAI API — GPT-4o (receipt parsing via vision) |
| Payments | None in V1 — manual transfer + proof of payment upload |
| Auth | Google Sign-In + Apple Sign-In (mandatory — no other login method) |
| Hosting | Railway or Render |
| Environment | `.env` file — never commit secrets |

---

## Core Concepts

### Users
A user signs in exclusively via Google or Apple. They can belong to **multiple groups** simultaneously. Phone number is collected optionally during onboarding but is not used for authentication.

### Groups
A group is a collection of people. Think of it as "the family" or "the uni friends". Groups have an invite code so new members can join. A group can have many expense pools.

### Expense Pools
A pool is a financial context within a group — e.g. "March Bills", "Trip to Paris". Not all group members need to be in every pool. A pool has a status: `active`, `settled`, or `closed`. Balances and settlements are scoped to a pool.

### Expenses
An expense is a bill that one person paid on behalf of the pool. It stores who paid, how much, what for, and optionally a receipt image. Splits are calculated from expenses.

### Splits
Each expense generates splits — one per pool member showing how much they owe the payer. Splits can be marked settled individually.

### Settlements
When a member wants to clear a balance, they make a bank transfer manually (outside the app) and then upload proof of payment — a screenshot or receipt — inside BillBot. The settlement is created with a status of `pending_verification`. The payee receives a notification, reviews the proof, and either confirms or disputes it. Only when the payee confirms does the settlement move to `settled` and the relevant splits are marked as cleared.

### Invites
Invites allow group members to bring in new users. An invite has a unique token, an expiry, and tracks whether the invitee was already a registered user or a new signup.

### Webhooks (Outbound)
BillBot fires outbound HTTP POST requests to a registered URL when key events happen. Consumers (e.g. a notification service, a WhatsApp bot layer, or a future SMS service) subscribe to these events per group.

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,         -- international format: +2348012345678
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  invite_code VARCHAR(12) UNIQUE NOT NULL,   -- e.g. MOLEFI-4821, auto-generated
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members (many-to-many: users <-> groups)
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',         -- 'admin' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Expense Pools
CREATE TABLE expense_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                -- e.g. "Trip to Paris"
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',       -- 'active' | 'settled' | 'closed'
  split_type VARCHAR(20) DEFAULT 'equal',    -- 'equal' (custom splits = future)
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pool Members (subset of group members per pool)
CREATE TABLE pool_members (
  pool_id UUID REFERENCES expense_pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, user_id)
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES expense_pools(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id),
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(5) DEFAULT 'NGN',
  description VARCHAR(255),
  category VARCHAR(50),                      -- 'rent' | 'school_fees' | 'food' | 'transport' | 'other'
  receipt_url TEXT,                          -- Supabase Storage URL
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Splits (one row per pool member per expense)
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  owed_by UUID REFERENCES users(id),
  amount NUMERIC(12, 2) NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ
);

-- Settlements (manual bank transfer + proof of payment confirmation)
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES expense_pools(id),
  from_user UUID REFERENCES users(id),           -- who is paying
  to_user UUID REFERENCES users(id),             -- who is receiving
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(5) DEFAULT 'NGN',
  proof_url TEXT,                                -- Supabase Storage URL for payment screenshot/receipt
  note TEXT,                                     -- optional message from payer e.g. "sent via Opay"
  status VARCHAR(30) DEFAULT 'pending_verification', -- 'pending_verification' | 'settled' | 'disputed'
  disputed_reason TEXT,                          -- filled by payee if they dispute
  confirmed_at TIMESTAMPTZ,                      -- when payee confirmed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  phone VARCHAR(20),                         -- if inviting by phone
  email VARCHAR(255),                        -- if inviting by email
  token VARCHAR(64) UNIQUE NOT NULL,         -- URL-safe random token
  status VARCHAR(20) DEFAULT 'pending',      -- 'pending' | 'accepted' | 'expired'
  expires_at TIMESTAMPTZ NOT NULL,           -- typically NOW() + 7 days
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound Webhook Subscriptions (per group)
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  url TEXT NOT NULL,                         -- the URL to POST to
  secret VARCHAR(100) NOT NULL,              -- for HMAC signature verification
  events TEXT[] NOT NULL,                    -- array of subscribed event types
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound Webhook Delivery Log (for debugging + retry)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',      -- 'delivered' | 'failed'
  response_code INT,
  attempts INT DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session tokens
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Routes

All authenticated routes require `Authorization: Bearer <token>` header.

Base URL: `https://api.billbot.app/v1`

---

### Auth

All users must sign in via Google or Apple — there is no email/password or phone OTP login. Both methods return the same response shape:

```json
{
  "success": true,
  "data": {
    "token": "billbot_sess_...",
    "user": { "id", "name", "email", "avatar_url", "created_at" },
    "isNewUser": true
  }
}
```

`isNewUser: true` tells the React Native client to show the onboarding flow (collect display name and optional phone number) before entering the app.

---

#### Google Sign-In

The React Native client uses `@react-native-google-signin/google-signin` to complete the Google OAuth flow natively. It sends the resulting `idToken` to the backend. The backend verifies it with Google and never handles Google credentials directly.

```
POST /auth/google
  Body: { idToken: "<Google ID token from client>" }

  Server steps:
  1. Verify idToken by calling Google's tokeninfo endpoint:
     GET https://oauth2.googleapis.com/tokeninfo?id_token=<idToken>
  2. Confirm the 'aud' field matches your GOOGLE_CLIENT_ID env var
     (prevents tokens issued for other apps being accepted)
  3. Extract: { sub (googleId), email, name, picture }
  4. Look up user by email in users table
  5. If user exists: issue session token, return user
  6. If new user: create user record with { name, email, avatar_url: picture },
     return token + user + isNewUser: true
     (phone is null at this point — prompt in onboarding)
```

---

#### Apple Sign-In

The React Native client uses `@invertase/react-native-apple-authentication` to complete Apple's native flow. It sends the `identityToken` (a signed JWT from Apple) to the backend.

**Important Apple behaviour to handle:**
- Apple only returns the user's name and email on the **very first login**. On subsequent logins, the `user` object from the client is empty. Always persist name and email on first login.
- Apple emails can be of the form `abc123@privaterelay.appleid.com` — store as-is, do not treat as invalid.

```
POST /auth/apple
  Body: {
    identityToken: "<Apple identity token>",
    fullName: { givenName, familyName },   -- only populated on first login
    email: "user@privaterelay.appleid.com" -- only populated on first login
  }

  Server steps:
  1. Fetch Apple's public keys:
     GET https://appleid.apple.com/auth/keys
  2. Verify identityToken as a JWT using the matching public key (match by 'kid' in header)
  3. Confirm 'iss' = "https://appleid.apple.com"
  4. Confirm 'aud' = your APPLE_BUNDLE_ID env var
  5. Extract 'sub' (appleUserId) from verified token payload
  6. Look up user by apple_id in users table
  7. If user exists: issue session token, return user
  8. If new user:
     - Build name from fullName (may be null on repeat installs — use "BillBot User" as fallback)
     - Create user record with { apple_id, name, email, avatar_url: null }
     - Return token + user + isNewUser: true
```

---

#### Session & Logout

```
POST /auth/logout
  Header: Authorization: Bearer <token>
  → Deletes session record from sessions table
  → Returns { message: "Logged out" }

GET /auth/me
  Header: Authorization: Bearer <token>
  → Returns current user (lightweight session check)
```

---

#### Schema additions for social auth

Add these columns to the `users` table:

```sql
ALTER TABLE users
  ADD COLUMN google_id VARCHAR(100) UNIQUE,
  ADD COLUMN apple_id VARCHAR(100) UNIQUE;

-- phone and email become nullable since social login users
-- may not provide a phone number upfront
ALTER TABLE users
  ALTER COLUMN phone DROP NOT NULL;
```

A user can link both social logins to the same account — matching is done by `email` first, then by `google_id` / `apple_id`. If a user signs in with Google and later with Apple using the same email, they resolve to the same account and both IDs are stored.

---

#### Environment variables to add

```env
GOOGLE_CLIENT_ID=...          # from Google Cloud Console (iOS client ID)
APPLE_BUNDLE_ID=app.billbot   # your app's bundle identifier
JWT_SECRET=...                # used to sign your own session tokens
```

---

#### Recommended npm packages

```
google-auth-library    → verifying Google ID tokens (official Google library)
apple-signin-auth      → verifying Apple identity tokens (handles key fetching + JWT verification)
jsonwebtoken           → if you switch sessions to stateless JWTs
```

The spec uses **database sessions** (token stored in `sessions` table) rather than stateless JWTs. This allows instant revocation on logout. If you prefer stateless JWTs, replace the sessions table with `jsonwebtoken` sign/verify and store only a refresh token.

---

### Users

```
GET  /users/me
  → Returns current user profile

PUT  /users/me
  Body: { name?, email?, avatar_url? }
  → Updates profile

GET  /users/search?phone=+234...
  → Find a user by phone (for inviting known users)
```

---

### Groups

```
POST /groups
  Body: { name, description? }
  → Creates group, adds creator as admin, generates invite_code
  → Fires webhook: group.created

GET  /groups
  → Lists all groups the current user belongs to

GET  /groups/:groupId
  → Group detail with members and pool summaries

DELETE /groups/:groupId
  → Soft delete (admin only)
```

---

### Group Members & Invites

```
POST /groups/:groupId/invites
  Body: { phone } or { email }
  → Creates invite record, sends SMS/email with link
  → If user already exists: notifies them in-app
  → If new user: generates deep link to download app + auto-join on signup
  → Fires webhook: member.invited

GET  /groups/:groupId/invites
  → Lists pending invites (admin only)

DELETE /groups/:groupId/invites/:inviteId
  → Cancels a pending invite (admin only)

POST /groups/join/:token
  → Accepts an invite by token, adds user to group
  → Marks invite as accepted
  → Fires webhook: member.joined

DELETE /groups/:groupId/members/:userId
  → Remove a member (admin only, cannot remove self if last admin)
  → Fires webhook: member.removed
```

---

### Expense Pools

```
POST /groups/:groupId/pools
  Body: { name, description?, memberIds: [userId, ...] }
  → Creates pool, adds specified members (must be group members)
  → Fires webhook: pool.created

GET  /groups/:groupId/pools
  → Lists all pools in the group (with status)

GET  /pools/:poolId
  → Pool detail: members, expense summary, total spent, balance overview

PUT  /pools/:poolId
  Body: { name?, description?, status? }
  → Update pool (admin only)
  → If status changes to 'settled': fires webhook: pool.settled

POST /pools/:poolId/members
  Body: { userId }
  → Add a group member to a pool
  → Fires webhook: pool.member_added

DELETE /pools/:poolId/members/:userId
  → Remove a member from pool (only if they have no unsettled splits)
```

---

### Expenses

```
POST /pools/:poolId/expenses
  Body (multipart/form-data):
    - amount: number
    - description: string
    - category: string
    - receipt: file (optional image — JPEG/PNG)
  → Saves receipt to Supabase Storage
  → Calculates equal splits among all pool members
  → Creates expense + split records
  → Fires webhook: expense.created

POST /pools/:poolId/expenses/parse-receipt
  Body (multipart/form-data):
    - receipt: file (image)
  → Sends image to Anthropic Claude vision API
  → Returns parsed { amount, description, category, date, merchant }
  → Does NOT save — client confirms before calling POST /expenses

GET  /pools/:poolId/expenses
  → Lists all expenses in pool (paginated), with split status per expense

GET  /expenses/:expenseId
  → Expense detail with full split breakdown

DELETE /expenses/:expenseId
  → Delete expense (only if no settled splits, payer or admin only)
  → Recalculates splits
  → Fires webhook: expense.deleted
```

---

### Balances

```
GET /pools/:poolId/balances
  → Returns simplified who-owes-who per pool
  → Algorithm: net each member's paid vs owed, then simplify debts
  → Response:
    {
      balances: [
        { from: { id, name }, to: { id, name }, amount: 4500.00, currency: "NGN" }
      ],
      memberSummary: [
        { user: { id, name }, totalPaid: 15000, totalOwed: 5000, netBalance: 10000 }
      ]
    }
```

---

### Settlements

The settlement flow is fully manual in V1. The payer makes a bank transfer outside the app, then uploads proof inside BillBot. The payee confirms before the balance clears.

```
POST /pools/:poolId/settlements
  Body (multipart/form-data):
    - toUserId: UUID
    - amount: number
    - proof: file (image — screenshot of transfer confirmation)
    - note?: string (e.g. "sent via Opay")
  → Saves proof image to Supabase Storage
  → Creates settlement record with status: 'pending_verification'
  → Fires webhook: settlement.submitted
  → Notifies payee (push notification / in-app)

GET /pools/:poolId/settlements
  → Lists all settlements in pool with status

GET /settlements/:settlementId
  → Settlement detail including proof image URL

POST /settlements/:settlementId/confirm
  Header: Authorization: Bearer <token>  (must be the to_user)
  → Verifies the requesting user is the payee
  → Sets status to 'settled', sets confirmed_at
  → Marks the relevant expense_splits as settled
  → Fires webhook: settlement.confirmed

POST /settlements/:settlementId/dispute
  Header: Authorization: Bearer <token>  (must be the to_user)
  Body: { reason: string }
  → Sets status to 'disputed', stores disputed_reason
  → Fires webhook: settlement.disputed
  → Notifies payer so they can re-upload or clarify
```

**Settlement → Split linking logic:**
When a settlement is confirmed, mark splits as settled greedily against the confirmed amount — starting from the oldest unsettled split owed by `from_user` to `to_user` until the settlement amount is exhausted.

---

### Webhook Subscriptions (Outbound)

```
POST /groups/:groupId/webhooks
  Body: { url, events: ["expense.created", "member.joined", ...] }
  → Registers a webhook URL for the group
  → Generates a signing secret returned once — store it

GET  /groups/:groupId/webhooks
  → Lists registered webhooks

DELETE /groups/:groupId/webhooks/:webhookId
  → Removes a webhook subscription
```

---

## Outbound Webhook Events

Every outbound webhook POST includes:

```json
{
  "event": "expense.created",
  "group_id": "uuid",
  "timestamp": "2025-04-12T10:00:00Z",
  "data": { ... }
}
```

A signature header `X-BillBot-Signature` is included — HMAC-SHA256 of the raw body using the subscription secret. Consumers must verify this.

### Event Types

| Event | Fired When |
|---|---|
| `group.created` | A new group is created |
| `member.invited` | A user is invited to a group |
| `member.joined` | A user accepts an invite and joins |
| `member.removed` | A member is removed from a group |
| `pool.created` | A new expense pool is created |
| `pool.settled` | A pool's status is changed to settled |
| `pool.member_added` | A user is added to a pool |
| `expense.created` | A new expense is logged in a pool |
| `expense.deleted` | An expense is deleted |
| `settlement.submitted` | Payer uploads proof of payment |
| `settlement.confirmed` | Payee confirms the payment — balance clears |
| `settlement.disputed` | Payee disputes the proof — payer is notified |

### Delivery & Retry

- Deliver asynchronously — do not block the API response
- Retry up to 3 times with exponential backoff (1m, 5m, 30m)
- Log all attempts in `webhook_deliveries` table
- A delivery is considered successful when the consumer returns HTTP 200
- Timeout per attempt: 10 seconds

---

## Receipt Parsing (AI)

Used in two places: parsing **expense receipts** when logging a bill, and parsing **settlement proof images** to extract transfer details for display.

Both use the OpenAI API with the `gpt-4o` model (vision). Send the image as a base64-encoded data URL in the message content.

**Expense receipt prompt:**
```
You are a receipt parser. Extract the following fields from this receipt image and return valid JSON only — no markdown, no explanation, no code fences:
{
  "amount": number or null,
  "currency": "NGN" | "KES" | "GHS" | "ZAR" | null,
  "merchant": string or null,
  "description": string or null,
  "category": "rent" | "school_fees" | "food" | "transport" | "utilities" | "medical" | "other" | null,
  "date": "YYYY-MM-DD" or null
}
If a field cannot be determined from the image, return null for that field.
```

**Settlement proof prompt:**
```
You are a payment proof parser. This image is a screenshot of a bank transfer or mobile money confirmation. Extract the following fields and return valid JSON only — no markdown, no explanation, no code fences:
{
  "amount": number or null,
  "currency": "NGN" | "KES" | "GHS" | "ZAR" | null,
  "sender": string or null,
  "recipient": string or null,
  "reference": string or null,
  "date": "YYYY-MM-DD" or null,
  "platform": string or null
}
If a field cannot be determined from the image, return null for that field.
```

**Important:** Parsing is always non-blocking and non-authoritative. The client receives the parsed object so the user can review and correct it. The raw image is always stored regardless of parse success. Never reject an upload because parsing failed — store the image and return `{ parsed: null, proof_url: "..." }` if parsing errors.

---

## Balance Calculation Algorithm

Given a pool, calculate simplified debts:

1. For each member, compute `net = totalPaid - totalOwed`
2. Members with positive net are **creditors** (are owed money)
3. Members with negative net are **debtors** (owe money)
4. Use a greedy simplification: match the largest debtor with the largest creditor, settle as much as possible, repeat
5. Result: minimum number of transactions to clear all balances

Example:
- Tunde paid 15,000 total, owes 5,000 → net +10,000 (creditor)
- Emeka paid 0 total, owes 5,000 → net -5,000 (debtor)
- Kemi paid 0 total, owes 5,000 → net -5,000 (debtor)
- Result: Emeka pays Tunde 5,000. Kemi pays Tunde 5,000.

---

---

## Environment Variables

```env
PORT=3000
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_KEY=...
OPENAI_API_KEY=sk-...
JWT_SECRET=...                   # for signing session tokens
GOOGLE_CLIENT_ID=...             # from Google Cloud Console (iOS client ID)
APPLE_BUNDLE_ID=app.billbot      # your app's bundle identifier
APP_BASE_URL=https://api.billbot.app
```

---

## Key Business Rules

1. **A user can belong to multiple groups** — no limit
2. **A pool member must first be a group member** — you cannot add someone to a pool without them being in the group
3. **Splits are equal by default** — divide expense amount equally among all pool members at the time of logging
4. **The payer is also included in splits** — if Tunde pays 15,000 for 3 people, each owes 5,000 including Tunde (so others owe Tunde 5,000 each, Tunde owes themselves nothing net)
5. **Expenses cannot be deleted if any split is already settled** — integrity of financial records
6. **Only pool admins (group admins) can close or settle a pool**
7. **Invite tokens expire after 7 days**
8. **Only the payee (to_user) can confirm or dispute a settlement** — the payer cannot self-confirm
9. **A disputed settlement does not block new settlements** — the payer can submit a new proof while the dispute stands
10. **Receipt and proof parsing is non-blocking** — always store the image; never reject an upload due to a parse failure
11. **Currency is stored per expense** — default NGN but support KES, GHS, ZAR for pan-African use

---

## What Claude Code Should Build

1. PostgreSQL schema migration file (full schema above, including google_id and apple_id columns)
2. Express app with all routes documented above
3. Auth routes — Google (`/auth/google`), Apple (`/auth/apple`), logout
4. Auth middleware (Bearer token lookup from sessions table)
5. Receipt parser service using OpenAI GPT-4o vision (expense receipts)
6. Proof parser service using OpenAI GPT-4o vision (settlement proof images)
7. Balance calculator service (debt simplification algorithm)
8. Outbound webhook dispatcher with retry logic
9. Supabase Storage integration for receipt images and settlement proof images
10. All controllers with proper error handling and input validation
11. `.env.example` file

Use ESM (`import/export`). Use async/await throughout. Return consistent JSON response shape:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human readable message", "code": "ERROR_CODE" }
```
