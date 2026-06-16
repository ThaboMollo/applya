# Phase 8 — Infrastructure Wiring (QStash, Auth, POPIA, Export)

**Spec references:** §4 (architecture), §8 (API), §9 (LLM), §11 (POPIA), §15 (tseboIQ design)
**Depends on:** All previous phases (this phase wires them together for production).
**Produces:** A fully wired, deployable pilot — end-to-end flow from upload to export with auth, queueing, and data retention.

---

## 1. What this phase delivers

The glue that makes everything production-ready for the private pilot:
- QStash two-phase queueing with the human gate pause.
- Supabase Auth (invite-only, magic link).
- POPIA-compliant data retention and deletion.
- SSE or polling for real-time status updates.
- Full end-to-end wiring of the Phase A → Human Gate → Phase B → Export flow.

---

## 2. QStash two-phase flow

### 2.1 How the human gate works with QStash

QStash is a serverless message queue that delivers jobs to HTTP endpoints. The human gate is trivially implemented: **Phase A enqueues nothing after finishing.** Phase B is only enqueued when the user explicitly calls `POST /sessions/:id/inventory/confirm`.

```
User uploads resume
  → API calls POST /sessions/:id/parse
    → API enqueues QStash message → POST /internal/phase-a/:id
      → Worker runs Stage 1 + Stage 2
      → Sets session status = INVENTORY_REVIEW
      → STOPS. No further messages enqueued.

[User reviews inventory in the UI — minutes, hours, or days later]

User clicks "Confirm"
  → API calls POST /sessions/:id/inventory/confirm
    → API enqueues QStash message → POST /internal/phase-b/:id
      → Worker runs Stage 3 → 4 → 5 → 6 → 7 → 8
      → Sets session status = READY
```

### 2.2 QStash configuration

```typescript
// apps/api/src/queue/qstash.service.ts

import { Client as QStashClient } from "@upstash/qstash";

export class QStashService implements QueueInterface {
  private client: QStashClient;

  constructor() {
    this.client = new QStashClient({
      token: process.env.QSTASH_TOKEN!,
    });
  }

  async enqueuePhaseA(sessionId: string): Promise<void> {
    await this.client.publishJSON({
      url: `${process.env.API_BASE_URL}/internal/phase-a/${sessionId}`,
      retries: 2,                  // retry on transient failures
      timeout: "300s",             // match Vercel function limit
    });
  }

  async enqueuePhaseB(sessionId: string): Promise<void> {
    await this.client.publishJSON({
      url: `${process.env.API_BASE_URL}/internal/phase-b/${sessionId}`,
      retries: 2,
      timeout: "300s",
    });
  }
}
```

### 2.3 Webhook security

QStash signs every request. The internal endpoints must verify the signature to prevent unauthorized calls:

```typescript
// apps/api/src/guards/qstash.guard.ts

import { Receiver } from "@upstash/qstash";

export class QStashGuard implements CanActivate {
  private receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers["upstash-signature"];
    const body = JSON.stringify(request.body);
    const url = `${process.env.API_BASE_URL}${request.url}`;

    return this.receiver.verify({ signature, body, url });
  }
}
```

### 2.4 Queue interface abstraction

The spec (§15) requires the queue to be swappable. Define an interface in `repositioner-core`:

```typescript
// packages/repositioner-core/src/interfaces/queue.interface.ts

export interface QueueInterface {
  enqueuePhaseA(sessionId: string): Promise<void>;
  enqueuePhaseB(sessionId: string): Promise<void>;
}
```

The NestJS API provides the `QStashService` implementation. If the backend moves to a container host later, a `BullMQService` can implement the same interface.

---

## 3. Supabase Auth (invite-only)

### 3.1 Configuration

- **Auth method:** Email magic link (passwordless).
- **Access control:** Invite-only for the pilot. Disable sign-up in Supabase dashboard; manually invite users via the Supabase admin panel or a seed script.
- **Session management:** Supabase Auth issues JWTs. The Next.js frontend uses `@supabase/ssr` for cookie-based sessions.

### 3.2 Auth flow

1. User visits the app → redirected to login if no session.
2. User enters email → Supabase sends a magic link.
3. User clicks link → Supabase verifies, sets session cookie.
4. Frontend includes the Supabase JWT in API requests via `Authorization: Bearer <token>`.
5. NestJS API validates the JWT using Supabase's JWKS endpoint.

### 3.3 Auth interface abstraction (tseboIQ readiness)

```typescript
// packages/repositioner-core/src/interfaces/auth.interface.ts

export interface CurrentUser {
  id: string;
  email: string;
}

// In the NestJS API, a decorator extracts CurrentUser from the Supabase JWT.
// When migrating to tseboIQ, this decorator is replaced with tseboIQ's identity system.
```

### 3.4 NestJS guard

```typescript
// apps/api/src/guards/auth.guard.ts

export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) return false;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;

    request.user = { id: user.id, email: user.email } as CurrentUser;
    return true;
  }
}
```

---

## 4. POPIA compliance

### 4.1 Data retention (auto-delete)

Sessions have an `expiresAt` field set on creation (default: 30 days). A scheduled cleanup job deletes expired data.

```typescript
// apps/api/src/tasks/cleanup.ts

export async function cleanupExpiredSessions(): Promise<void> {
  const expired = await prisma.session.findMany({
    where: { expiresAt: { lte: new Date() } },
  });

  for (const session of expired) {
    // 1. Delete files from Supabase Storage
    if (session.resumeFileKey) {
      await supabase.storage.from("uploads").remove([session.resumeFileKey]);
    }
    if (session.outputDocxKey) {
      await supabase.storage.from("outputs").remove([session.outputDocxKey]);
    }
    if (session.outputPdfKey) {
      await supabase.storage.from("outputs").remove([session.outputPdfKey]);
    }

    // 2. Delete the session row (cascades JSON fields)
    await prisma.session.delete({ where: { id: session.id } });
  }
}
```

**Scheduling:** Use QStash's CRON feature to trigger this daily:
```typescript
// QStash CRON: POST /internal/cleanup, schedule: "0 3 * * *" (3 AM daily)
```

### 4.2 User-initiated deletion

```
DELETE /sessions/:id
```

Immediately deletes all files and the session row. No soft-delete — the data is gone.

### 4.3 Consent at upload

The upload screen must include:
- A clear purpose statement: "We will process your resume to re-position it for a target job. Your data is stored securely and auto-deleted after 30 days."
- A consent checkbox: "I agree to the processing of my resume data as described."
- A link to the privacy policy.

### 4.4 Privacy policy requirements

The privacy policy must disclose:
- What data is collected (resume file, extracted text, JD text).
- How it's processed (parsed locally via Docling, de-identified text sent to Google Gemini API for analysis).
- That the Gemini free tier may use prompts for training — and that PII is redacted before sending.
- Retention period (30 days, or immediate on user request).
- User rights (access, correction, deletion).

---

## 5. Real-time status updates

### 5.1 Polling (MVP)

The simplest approach: the frontend polls `GET /sessions/:id` every 2–3 seconds while the session is in `PARSING` or `OPTIMISING` status.

```typescript
// apps/web — React hook
function useSessionStatus(sessionId: string) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      setSession(data);

      if (data.status === "INVENTORY_REVIEW" || data.status === "READY" || data.status === "FAILED") {
        clearInterval(interval);  // stop polling once we reach a terminal or human-gate state
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId]);

  return session;
}
```

### 5.2 SSE (stretch goal)

The spec mentions SSE (`/sessions/:id/stream`). If polling feels too slow or wastes requests:

```typescript
// apps/api — NestJS SSE endpoint
@Sse("sessions/:id/stream")
stream(@Param("id") id: string): Observable<MessageEvent> {
  // Emit events when session status changes
  // Frontend: const eventSource = new EventSource(`/api/sessions/${id}/stream`);
}
```

This is a nice-to-have for the pilot. Polling is fine for low traffic.

---

## 6. End-to-end flow summary

```
1. User logs in via Supabase Auth (magic link)
2. User uploads resume + pastes JD
   → POST /sessions (creates session, stores file, stores JD text)
   → POST /sessions/:id/parse (enqueues Phase A via QStash)
3. QStash calls POST /internal/phase-a/:id
   → Stage 1: parse document (Docling or SimpleParser)
   → Stage 2: extract inventory (Gemini Flash)
   → Session status → INVENTORY_REVIEW
4. Frontend polls until status = INVENTORY_REVIEW, then shows inventory review screen
5. User reviews, edits, attests, confirms
   → PATCH /sessions/:id/inventory (edits)
   → POST /sessions/:id/inventory/confirm (freezes inventory, enqueues Phase B)
6. QStash calls POST /internal/phase-b/:id
   → Stage 3: extract JD requirements
   → Stage 4: match & gap analysis
   → Stage 5: generate reposition plan
   → Stage 6: programmatic validation
   → Stage 7: LLM judge
   → Stage 8: render DOCX/PDF
   → Session status → READY
7. Frontend polls until status = READY, then shows review/diff screen
8. User reviews diff, accepts/rejects changes, picks template, exports
   → PATCH /sessions/:id/decisions
   → POST /sessions/:id/export
   → GET /sessions/:id/download/docx
```

---

## 7. Environment variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...

# QStash
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# Gemini
GEMINI_API_KEY=...

# Docling
DOCLING_SERVE_URL=http://localhost:5001   # or https://docling.fly.dev

# App
API_BASE_URL=https://api.fitcv.app        # or http://localhost:3001 in dev
NEXT_PUBLIC_API_URL=https://api.fitcv.app
```

---

## 8. Verification checklist

- [ ] QStash successfully delivers Phase A and Phase B messages to the internal endpoints.
- [ ] QStash signatures are verified; unauthenticated requests to `/internal/*` are rejected.
- [ ] Supabase Auth magic link flow works end-to-end.
- [ ] Only invited users can log in (sign-up is disabled).
- [ ] JWT validation works in the NestJS API guard.
- [ ] Session data is auto-deleted after `expiresAt`.
- [ ] `DELETE /sessions/:id` immediately removes all files and data.
- [ ] The consent checkbox blocks upload until checked.
- [ ] The full end-to-end flow (upload → parse → review → confirm → generate → review → export) works.
- [ ] The app is deployable to Vercel (frontend + API) with all environment variables configured.
