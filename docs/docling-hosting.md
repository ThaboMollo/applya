# Docling Serve — Hosting & Deployment Plan

**Purpose:** Host a single shared Docling Serve instance that both dev and production environments use for resume parsing.

---

## 1. Current State

**What's ready:**
- ✅ `docker-compose.yml` — works for local development.
- ✅ `DoclingClient` in `packages/repositioner-core/src/parser/index.ts` — fully functional HTTP client with health checks, timeouts, and error handling.
- ✅ `MvpStubParser` fallback — `mammoth` + `pdf-parse` when Docling is unavailable.
- ✅ `DOCLING_SERVE_URL` environment variable controls which parser is used.

**What needs doing:**
- Deployment configuration for the hosted instance.
- Image tag pinning (currently `:latest` — unsafe for production).
- Basic access control (the endpoint is unauthenticated).

---

## 2. Hosting Recommendation: **Railway**

### Why Railway over Fly.io

| Factor | Railway | Fly.io |
|--------|---------|--------|
| **Docker support** | Native — deploy any image directly | Native via `fly.toml` |
| **Scale-to-zero** | ✅ Built-in auto-sleep after inactivity | ✅ Via `min_machines_running = 0` |
| **Memory** | Up to 32 GB on Hobby plan | Up to 4 GB on shared CPUs (needs performance CPUs for more) |
| **Cold start** | ~30–90s (model loading) | ~30–90s (model loading) + microVM boot |
| **Pricing** | Pay-as-you-go. Hobby plan: $5/month credit, then usage-based (~$0.000231/min for 8 GB RAM) | Pay-as-you-go. No free tier for new users. ~$5/month for an always-running small machine |
| **Ease of setup** | One-click Docker image deploy | Requires `flyctl` CLI + `fly.toml` config |
| **Docling templates** | ✅ Pre-built templates exist on Railway marketplace | ❌ No marketplace — manual setup |
| **Persistent volumes** | ✅ Easy attach | ✅ Easy attach |

**Verdict: Railway** is the better fit because:
1. It has existing Docling Serve templates in the marketplace.
2. Its auto-sleep feature reduces idle cost to near-zero for pilot usage.
3. Simpler setup — no CLI tooling or config files needed.
4. 8 GB RAM is within Hobby plan limits (Docling needs 4–8 GB).

### Estimated monthly cost (pilot)

With auto-sleep enabled and ~5–10 parses per day during the pilot:
- **Active time:** ~5 min/day × 30 days = ~150 min/month.
- **RAM:** 8 GB → ~$0.000231/min × 150 min = **~$0.03/month**.
- **CPU:** Shared 2 vCPU → similarly negligible.
- **Total:** Under **$1/month** during pilot (well within the $5 Hobby credit).

If kept always-on (no sleep): ~$10–15/month for 8 GB RAM.

---

## 3. Deployment Steps (Railway)

### 3.1 Create the service

1. Go to [railway.com](https://railway.com) → New Project → Deploy from Docker Image.
2. Image: `quay.io/docling-project/docling-serve:latest` (pin to a specific tag before go-live — see §5).
3. Or search the Railway marketplace for "Docling" and use a pre-configured template.

### 3.2 Environment variables

```
DOCLING_SERVE_ENABLE_UI=false
UVICORN_WORKERS=1
DOCLING_SERVE_ENABLE_MANAGEMENT_ENDPOINTS=true
```

| Variable | Value | Reason |
|----------|-------|--------|
| `DOCLING_SERVE_ENABLE_UI` | `false` | No Gradio UI needed — API-only usage |
| `UVICORN_WORKERS` | `1` | Prevents OOM on constrained memory. 1 worker is fine for pilot volume. |
| `DOCLING_SERVE_ENABLE_MANAGEMENT_ENDPOINTS` | `true` | Enables `/v1/memory/stats` for monitoring |

### 3.3 Resource limits

- **RAM:** 8 GB (recommended minimum for reliable parsing of complex resumes).
- **CPU:** 2 shared vCPU.
- **Disk:** Default (no persistent volume needed — Docling is stateless).

### 3.4 Networking

- Railway assigns a public URL: `https://docling-serve-production-xxxx.up.railway.app`.
- The internal port is `5001` (default Docling Serve port) — Railway auto-maps it.

### 3.5 Auto-sleep

Enable Railway's auto-sleep feature:
- Sleep after **5 minutes** of inactivity.
- Wake on incoming request (adds ~30–90s cold start on first parse after sleep — acceptable for pilot).

---

## 4. Access Control

Docling Serve has **no built-in authentication**. The endpoint is open to anyone who knows the URL. For the pilot this is acceptable (obscurity + low traffic), but we should add a layer before wider use.

### 4.1 MVP (pilot): Rely on URL obscurity

- The Railway URL is randomly generated and not published.
- Only the `DOCLING_SERVE_URL` env var in the API knows it.
- Acceptable risk for a private pilot with invited users only.

### 4.2 Before wider pilot: Add a shared secret header

Add a lightweight auth layer using Railway's built-in middleware or a reverse proxy:

**Option A — API key via Railway's Custom Headers:**
Configure Railway to require a custom header (e.g., `X-Docling-Key: <secret>`). Requests without it are rejected.

**Option B — Update the `DoclingClient` to send an auth header:**
```typescript
// packages/repositioner-core/src/parser/index.ts (future addition)
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (this.apiKey) {
  headers['Authorization'] = `Bearer ${this.apiKey}`;
}
```

And place a small authentication proxy (e.g., Caddy or nginx) in front of Docling on Railway.

---

## 5. Production Hardening Checklist

### 5.1 Pin the image tag

The current `docker-compose.yml` uses `:latest` — this is fine for local dev but dangerous for a shared hosted instance. Pin to a specific version:

```yaml
# docker-compose.yml (local dev)
image: quay.io/docling-project/docling-serve:v0.4.0  # pin version

# Railway deployment
# Set the image to the same pinned tag
```

Check the latest stable tag at [quay.io/docling-project/docling-serve](https://quay.io/repository/docling-project/docling-serve?tab=tags).

### 5.2 Update the `DoclingClient` timeout

The current 120s timeout is fine for cold starts. However, add a retry for the case where Railway wakes the container:

```typescript
// First request after sleep may timeout while the container boots.
// The DoclingClient should:
// 1. Call /health first (already done via assertHealthy())
// 2. If health check times out, wait 10s and retry once
// 3. If health check passes, proceed with the parse call
```

### 5.3 Monitoring

With `DOCLING_SERVE_ENABLE_MANAGEMENT_ENDPOINTS=true`, you can hit:
- `GET /v1/memory/stats` — current memory usage.
- `GET /v1/memory/counts` — request counts.

Set up a periodic health check (e.g., via UptimeRobot or Railway's built-in health checks) to alert if the service goes down.

---

## 6. Environment Variable Updates

Once hosted, update the API env vars to point at the Railway instance:

```bash
# apps/api/.env.local (dev — can use the same hosted instance or local Docker)
DOCLING_SERVE_URL=https://docling-serve-production-xxxx.up.railway.app

# apps/api/.env.production (live)
DOCLING_SERVE_URL=https://docling-serve-production-xxxx.up.railway.app
```

Both dev and production share the same instance. This is fine for the pilot (low traffic, no isolation needed). For later scale-up, spin a second Railway service for staging.

---

## 7. Summary

| Item | Status |
|------|--------|
| `DoclingClient` code | ✅ Ready — no changes needed |
| `MvpStubParser` fallback | ✅ Ready — auto-used when `DOCLING_SERVE_URL` is unset |
| `docker-compose.yml` for local | ✅ Ready — pin image tag |
| Hosting platform | **Railway** (Hobby plan, ~$0–5/month with auto-sleep) |
| Auth | MVP: URL obscurity. Pre-wider-pilot: shared secret header. |
| Image tag | ⚠️ Pin to a specific version before deploying |
| Memory | 8 GB recommended |
| Cold start | ~30–90s after sleep (acceptable for pilot) |
