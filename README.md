# BillBot Backend

REST API for BillBot — a shared expense splitting and settlement platform for African users managing communal financial obligations (family bills, group trips, rent, school fees).

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL (Drizzle ORM) |
| DI Container | tsyringe |
| Validation | Zod |
| Auth | Google Sign-In + Apple Sign-In (database sessions) |
| File Storage | Cloudinary |
| AI | OpenAI GPT-4o (receipt + proof parsing) |
| Logging | Winston |
| API Docs | Swagger UI (`/api-docs`) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL) or a PostgreSQL instance
- Cloudinary account (for file storage)
- Google Cloud Console project (for Google Sign-In)
- OpenAI API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your values in `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/billbot
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-min-32-chars
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
APPLE_BUNDLE_ID=app.billbot
APP_BASE_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:3001
```

### 3. Start the database

```bash
docker-compose up -d
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

The API is available at `http://localhost:3000/v1`.  
Swagger docs at `http://localhost:3000/api-docs`.

---

## API Reference

All routes except `/auth/google` and `/auth/apple` require an `Authorization: Bearer <token>` header. The token is returned when you sign in.

---

### Auth

Authentication is via Google or Apple only — there is no email/password login.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/auth/google` | Takes a Google ID token from the mobile client, verifies it with Google, and returns a session token. If the user is signing in for the first time, `isNewUser: true` is included so the app can show the onboarding screen. |
| `POST` | `/v1/auth/apple` | Same as above but for Apple Sign-In. Apple only sends the user's name and email on the very first login, so the server stores them immediately. |
| `POST` | `/v1/auth/logout` | Deletes the current session from the database. The token stops working immediately. |
| `GET` | `/v1/auth/me` | Returns the profile of whoever is currently signed in. Useful as a lightweight session check on app start. |

---

### Users

| Method | Route | What it does |
|---|---|---|
| `GET` | `/v1/users/me` | Returns the signed-in user's profile (name, email, phone, avatar). |
| `PUT` | `/v1/users/me` | Updates the signed-in user's profile. Accepts `name`, `email`, `avatar_url`, `phone`. |
| `GET` | `/v1/users/search?phone=+234...` | Searches for a registered user by their phone number. Used when inviting someone you already know. |

---

### Groups

A group is a collection of people — think "the family" or "uni friends". One user can belong to multiple groups. The person who creates the group becomes its admin and a unique invite code is automatically generated.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/groups` | Creates a new group. The creator is automatically added as admin. An invite code (e.g. `TUNDE-4821`) is generated so others can join. |
| `GET` | `/v1/groups` | Lists all groups the signed-in user belongs to. |
| `GET` | `/v1/groups/:groupId` | Returns the full details of a group: name, invite code, and a list of all members with their roles. |
| `DELETE` | `/v1/groups/:groupId` | Deletes the group. Admin only. |
| `DELETE` | `/v1/groups/:groupId/members/:userId` | Removes a member from the group. Admin only. You cannot remove the last admin. |

---

### Invites

Invites are how new people join a group. Each invite has a unique token that expires after 7 days.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/groups/:groupId/invites` | Creates an invite for someone by their phone number or email. The token can be sent as a deep link or SMS. |
| `GET` | `/v1/groups/:groupId/invites` | Lists all pending (not yet accepted or expired) invites for the group. Admin only. |
| `DELETE` | `/v1/groups/:groupId/invites/:inviteId` | Cancels a pending invite before it is used. Admin only. |
| `POST` | `/v1/groups/join/:token` | The invited person calls this to accept the invite and join the group. The token is marked as accepted and cannot be reused. |

---

### Expense Pools

A pool is a financial context inside a group — e.g. "March Bills", "Trip to Paris", "Kofi's Wedding". Not every group member has to be in every pool. A pool tracks all expenses, splits, and settlements within it.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/groups/:groupId/pools` | Creates a new pool inside a group. You specify which group members to include (`memberIds`). All specified members plus the creator are added to the pool. |
| `GET` | `/v1/groups/:groupId/pools` | Lists all pools in a group, with their status (`active`, `settled`, or `closed`). |
| `GET` | `/v1/pools/:poolId` | Returns the full details of a pool: name, status, and all its members. |
| `PUT` | `/v1/pools/:poolId` | Updates a pool's name, description, or status. Admin only. Changing status to `settled` fires a `pool.settled` webhook event. |
| `POST` | `/v1/pools/:poolId/members` | Adds a group member to an existing pool. The person must already be in the group. |
| `DELETE` | `/v1/pools/:poolId/members/:userId` | Removes a member from the pool. Admin only. |

---

### Expenses

An expense is a bill that one person paid on behalf of the whole pool. When an expense is logged, the amount is split equally among all pool members automatically — including the person who paid.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/pools/:poolId/expenses` | Logs a new expense. Accepts `amount`, `description`, `category`, and an optional receipt image. The image is uploaded to Cloudinary. Equal splits are created for every pool member at the time of logging. |
| `POST` | `/v1/pools/:poolId/expenses/parse-receipt` | Upload a receipt image and let GPT-4o read it. Returns the extracted `amount`, `merchant`, `category`, and `date`. The client uses this to pre-fill the expense form — the user reviews and confirms before anything is saved. |
| `GET` | `/v1/pools/:poolId/expenses` | Returns a paginated list of all expenses in the pool, with split status per expense. |
| `GET` | `/v1/pools/:poolId/expenses/:expenseId` | Returns a single expense with the full split breakdown — who owes what and whether each split is settled. |
| `DELETE` | `/v1/pools/:poolId/expenses/:expenseId` | Deletes an expense. Only the person who paid can delete it. Deletion is blocked if any of the splits have already been settled, to protect the financial record. |

---

### Balances

The balance endpoint tells you who owes who and how much, after simplifying all the debts in a pool down to the minimum number of payments needed.

| Method | Route | What it does |
|---|---|---|
| `GET` | `/v1/pools/:poolId/balances` | Returns two things: (1) a simplified list of payments — e.g. "Emeka pays Tunde ₦5,000" — and (2) a summary of each member's total paid, total owed, and net balance. |

**How the simplification works:**

Imagine three people in a pool:
- Tunde paid ₦15,000 total and owes ₦5,000 → he is owed ₦10,000 net
- Emeka paid nothing and owes ₦5,000 → he owes ₦5,000 net
- Kemi paid nothing and owes ₦5,000 → she owes ₦5,000 net

Instead of showing a tangled web of individual split records, the balance calculator produces the simplest set of payments to clear everything:
1. Emeka pays Tunde ₦5,000
2. Kemi pays Tunde ₦5,000

The algorithm works by pairing the biggest debtor with the biggest creditor, settling as much as possible in one payment, then moving on to the next pair — until all balances reach zero.

---

### Settlements

Settlements are how members actually pay each other back. There are no in-app payments — the payer makes a real bank transfer (via Opay, bank app, etc.) and then uploads a screenshot inside BillBot as proof. The payee reviews the screenshot and either confirms or disputes it.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/pools/:poolId/settlements` | The payer submits a settlement. They upload a screenshot of their bank transfer confirmation along with the amount and who they are paying. The screenshot is stored on Cloudinary. GPT-4o quietly tries to read the transfer details from the image in the background, but this never blocks or rejects the submission. The settlement is created with status `pending_verification`. |
| `GET` | `/v1/pools/:poolId/settlements` | Lists all settlements in the pool with their current status. |
| `GET` | `/v1/settlements/:settlementId` | Returns the full details of a single settlement, including the proof image URL so the payee can view the screenshot. |
| `POST` | `/v1/settlements/:settlementId/confirm` | The payee calls this to confirm they received the money. The settlement status changes to `settled`. The system then automatically marks the relevant expense splits as cleared, working from the oldest unsettled split first until the full settlement amount is accounted for. Only the payee (the person being paid) can call this — the payer cannot confirm their own payment. |
| `POST` | `/v1/settlements/:settlementId/dispute` | The payee calls this if the screenshot looks wrong or the money was not received. The settlement status changes to `disputed` and a reason is stored. The payer is notified and can upload a new settlement without waiting for the dispute to be resolved. |

**Settlement status flow:**

```
submitted by payer
       ↓
pending_verification
       ↓               ↓
   settled          disputed
(payee confirms)  (payee disputes)
```

---

### Webhooks

Webhooks let external services (a WhatsApp bot, an SMS service, a notification server) receive real-time events from BillBot without polling the API.

| Method | Route | What it does |
|---|---|---|
| `POST` | `/v1/groups/:groupId/webhooks` | Registers a URL to receive events for a group. You specify which events you want (see list below). A signing secret is returned once — save it immediately, it is not shown again. Admin only. |
| `GET` | `/v1/groups/:groupId/webhooks` | Lists all registered webhook URLs for the group. Secrets are never included in the response. Admin only. |
| `DELETE` | `/v1/groups/:groupId/webhooks/:webhookId` | Removes a webhook subscription. |

**Events you can subscribe to:**

| Event | When it fires |
|---|---|
| `group.created` | A new group is created |
| `member.invited` | Someone is invited to a group |
| `member.joined` | An invited person accepts and joins |
| `member.removed` | A member is removed from a group |
| `pool.created` | A new expense pool is created |
| `pool.settled` | A pool's status is changed to settled |
| `pool.member_added` | A user is added to a pool |
| `expense.created` | A new expense is logged |
| `expense.deleted` | An expense is deleted |
| `settlement.submitted` | A payer uploads proof of payment |
| `settlement.confirmed` | The payee confirms the payment |
| `settlement.disputed` | The payee disputes the proof |

Every webhook `POST` includes an `X-BillBot-Signature` header — an HMAC-SHA256 signature of the request body using your secret. Verify this on your server to confirm the request is genuinely from BillBot.

If your endpoint does not return HTTP 200, delivery is retried up to 3 times: after 1 minute, 5 minutes, and 30 minutes. All delivery attempts are logged in the database.

---

## Database Scripts

```bash
npm run db:generate   # Generate a new migration file from schema changes
npm run db:migrate    # Apply all pending migrations
npm run db:push       # Push schema directly to the DB (dev only, skips migration files)
npm run db:studio     # Open Drizzle Studio — a browser GUI for your database
```

---

## Project Structure

```
src/
├── index.ts                  # Entry point — starts the server
├── app.ts                    # Express app wiring: middleware, routes, error handling
├── init-dependencies.ts      # DI container — registers all modules in dependency order
├── common/
│   ├── configuration/        # All env vars loaded here and exported as CONSTANTS
│   ├── constants/            # DI tokens for the container
│   ├── decorators/           # @Controller, @Get, @Post, @Put, @Delete
│   ├── exception/            # Typed HTTP exceptions (BadRequest, NotFound, etc.)
│   ├── lib/                  # Database client, Winston logger, Swagger setup,
│   │                         # Cloudinary storage, OpenAI parser
│   ├── types/                # Shared TypeScript interfaces
│   └── utils/                # Token/invite code generation, route mounting
├── middleware/
│   ├── authentication.middleware.ts   # Looks up Bearer token in sessions table
│   ├── global-exception.middleware.ts # 404 handler + global error formatter
│   └── traffic-filter.middleware.ts   # Rate limiter + probe path blocker
└── modules/
    ├── auth/                 # Google + Apple sign-in, session management
    ├── users/                # User profile read + update
    ├── groups/               # Group creation, membership, admin actions
    ├── invites/              # Invite token creation, cancellation, join flow
    ├── pools/                # Expense pool CRUD + member management
    ├── expenses/             # Expense logging, equal splits, AI receipt parsing
    ├── balances/             # Debt simplification and balance summaries
    ├── settlements/          # Proof upload, confirm/dispute flow, split clearing
    └── webhooks/             # Subscription management + async event dispatcher
```
