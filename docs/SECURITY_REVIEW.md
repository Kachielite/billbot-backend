# BillBot Backend Security Review

Date: 2026-04-12
Scope: `src/**`, middleware/auth flow, webhook surface, file upload flow, and npm dependency vulnerabilities.

## Executive Summary

This review found **2 high-impact code-level authorization issues** and multiple additional security hardening gaps. Dependency scanning (`npm audit`) also reports several high-severity vulnerabilities in production dependencies.

Top priorities:
1. Fix route protection gaps in auth middleware (auth bypass risk).
2. Fix pool member management authorization (privilege escalation risk).
3. Restrict webhook callback targets to prevent SSRF.
4. Patch vulnerable production dependencies (`drizzle-orm`, `bcrypt`, `nodemailer`).

---

## Findings (Prioritized)

### 1) Missing auth enforcement for protected `/auth` endpoints
- **Severity:** High
- **Files:** `src/middleware/authentication.middleware.ts:11-22`, `src/modules/auth/auth.controller.ts:146-172`
- **Issue:** Auth is enforced by `authPrefixes` (`/v1/users`, `/v1/groups`, etc.). Routes under `/v1/auth/*` are excluded except two explicit public paths (`/auth/google`, `/auth/apple`). As implemented, `/v1/auth/me` and `/v1/auth/logout` do not require a bearer token.
- **Risk:** Endpoints intended to be authenticated can be called without valid session context, causing inconsistent behavior and potential unauthorized access paths as auth module grows.
- **Recommendation:**
  - Move to a **deny-by-default** model: require auth globally, then explicitly allow public routes.
  - Alternatively, include `/v1/auth` in protected prefixes and explicitly exempt only `/v1/auth/google` and `/v1/auth/apple`.

### 2) Authorization bypass in pool member addition
- **Severity:** High
- **Files:** `src/modules/pools/pools.service.ts:150-177`
- **Issue:** `addMember(poolId, userId, data)` accepts the caller user id but **does not use it** for authorization checks.
- **Risk:** Any authenticated user that can hit this route can add members to any pool (if they know `poolId` and target is group member), bypassing admin intent.
- **Recommendation:**
  - Enforce caller role before mutating membership (admin of group/pool).
  - Add tests for unauthorized caller attempts.

### 3) Potential SSRF via webhook subscription URLs
- **Severity:** High
- **Files:** `src/modules/webhooks/webhooks.dto.ts:18-20`, `src/modules/webhooks/webhooks.dispatcher.ts:63-71`
- **Issue:** Any valid URL is accepted for webhooks; dispatcher performs server-side POST requests to that URL.
- **Risk:** Admin accounts (or compromised admins) can force requests to internal addresses/services (`localhost`, cloud metadata IPs, private RFC1918 ranges), enabling SSRF and internal reconnaissance.
- **Recommendation:**
  - Enforce `https` scheme.
  - Block private/internal hostnames and IP ranges after DNS resolution.
  - Optionally apply an allowlist of approved domains for webhook targets.

### 4) Insecure fallback secret in configuration
- **Severity:** Medium
- **File:** `src/common/configuration/constants.ts:13`
- **Issue:** `JWT_SECRET` defaults to `'changeme-secret'`.
- **Risk:** If any JWT path is introduced/used with this fallback in non-local environments, token forgery becomes trivial.
- **Recommendation:**
  - Fail fast at startup when required secrets are absent in non-dev environments.
  - Remove weak default secrets.

### 5) Rate limiting design is weak for production
- **Severity:** Medium
- **File:** `src/middleware/traffic-filter.middleware.ts:6-40`
- **Issue:** In-memory map keyed by IP, no eviction sweep, process-local only.
- **Risk:**
  - Easy bypass across multiple instances/processes.
  - Memory growth over time from unbounded key accumulation.
  - Potential IP accuracy issues behind proxies without trusted proxy config.
- **Recommendation:**
  - Use Redis-backed limiter (`rate-limit-redis` or equivalent).
  - Configure `trust proxy` correctly and add periodic eviction if memory fallback remains.

### 6) File upload validation relies on MIME type and uses memory storage
- **Severity:** Medium
- **Files:** `src/modules/expenses/expenses.controller.ts:17-27`, `src/modules/settlements/settlements.pool-controller.ts:11-21`
- **Issue:** Validation trusts `file.mimetype` from client and buffers whole files in memory.
- **Risk:** Crafted payloads can bypass naive MIME checks; concurrent uploads can increase memory pressure/DoS risk.
- **Recommendation:**
  - Validate file signatures/magic bytes server-side.
  - Keep strict size limits and add request concurrency/backpressure controls.
  - Consider streaming pipelines where possible.

### 7) Session/webhook secrets stored in plaintext
- **Severity:** Medium
- **Files:** `src/modules/auth/auth.service.ts:162-169`, `src/modules/auth/auth.repository.ts`, `src/modules/webhooks/webhooks.repository.ts`
- **Issue:** Session tokens and webhook secrets are persisted in plaintext.
- **Risk:** Database read exposure immediately enables session hijack and webhook signature forgery.
- **Recommendation:**
  - Store token/secret hashes (e.g., SHA-256 with salt/pepper design decisions) and compare on hash.
  - Keep one-time display for webhook secret but persist only hashed value where feasible.

### 8) Defensive controls not environment-gated
- **Severity:** Low
- **Files:** `src/common/lib/swagger/index.ts:119-125`, `src/init-dependencies.ts:26-28`
- **Issue:** Swagger docs and DB migration run on every startup without environment gating.
- **Risk:** Operational exposure (API discovery in prod, migration timing/race concerns).
- **Recommendation:**
  - Gate Swagger in production or protect it with auth/network ACL.
  - Run migrations via controlled release step (CI/CD job) rather than app boot.

---

## Dependency Vulnerability Review

Commands run:
- `npm audit --json`
- `npm audit --omit=dev --json`

### Production dependencies (`--omit=dev`)
- **High severity vulnerabilities found: 5**
- Affected direct packages:
  - `drizzle-orm@0.30.10` (advisory: SQL injection via improperly escaped identifiers, fixed in `>=0.45.2`)
  - `bcrypt@5.1.1` (transitive `tar` issues via `@mapbox/node-pre-gyp`, fix path points to `bcrypt@6.0.0`)
  - `nodemailer@6.9.14` (multiple advisories including DoS/injection classes; fix available in `8.0.5`)

### Dev dependency exposure
- `drizzle-kit@0.21.4` and transitive `esbuild` advisories are present (moderate).
- Lower runtime impact than prod vulns but should still be addressed.

### Recommended upgrade order
1. Upgrade `drizzle-orm` to `>=0.45.2` and run integration tests for query behavior.
2. Upgrade `nodemailer` to patched major (`8.x`) if mail functionality is used; validate transport config and address parsing behavior.
3. Upgrade `bcrypt` to `6.x` and re-test password hash/compare behavior.
4. Upgrade `drizzle-kit` to current secure line and re-test migration workflows.
5. Re-run `npm audit --omit=dev` and fail CI if high/critical remain.

---

## Quick Hardening Checklist

- [ ] Replace prefix-based auth checks with explicit public-route allowlist + auth-by-default.
- [ ] Add role checks in `PoolService.addMember` using caller `userId`.
- [ ] Add webhook URL SSRF protections (https-only + private network denylist).
- [ ] Remove weak secret fallbacks and enforce required env vars at startup.
- [ ] Move to distributed rate limiting and configure trusted proxies.
- [ ] Add file content sniffing for uploads.
- [ ] Hash stored session/webhook secrets.
- [ ] Patch vulnerable dependencies and enforce audit in CI.

## Notes / Assumptions

- This is a static review plus dependency audit output; no dynamic penetration test was performed.
- Risk severity assumes this API is internet-reachable and processes untrusted client input.

