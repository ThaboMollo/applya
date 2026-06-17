const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { createClient } = await import('./supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch { /* server-side or no session */ }
  return {};
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...authHeaders, ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function uploadResume(file: File): Promise<{ sessionId: string; status: string }> {
  const form = new FormData();
  form.append('resume', file);
  return req('/sessions', { method: 'POST', body: form });
}

export async function attachJob(sessionId: string, jobDescription: string) {
  return req(`/sessions/${sessionId}/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription }),
  });
}

export async function getSession(sessionId: string) {
  return req<SessionData>(`/sessions/${sessionId}`);
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function getInventory(sessionId: string): Promise<{ inventory: CandidateInventory; confirmed: boolean }> {
  return req(`/sessions/${sessionId}/inventory`);
}

export async function patchInventory(
  sessionId: string,
  payload: { edits?: InventoryEdit[]; attestations?: Attestation[] },
) {
  return req(`/sessions/${sessionId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function confirmInventory(sessionId: string) {
  return req(`/sessions/${sessionId}/inventory/confirm`, { method: 'POST' });
}

// ── Decisions ────────────────────────────────────────────────────────────────

export async function saveDecisions(sessionId: string, decisions: Decision[]) {
  return req(`/sessions/${sessionId}/decisions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisions }),
  });
}

// ── Templates + export ────────────────────────────────────────────────────────

export async function getTemplates(sessionId: string): Promise<{ templates: Template[]; default: string }> {
  return req(`/sessions/${sessionId}/templates`);
}

export async function triggerExport(sessionId: string, templateId: string, format: 'docx' | 'pdf') {
  return req(`/sessions/${sessionId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, format }),
  });
}

export async function getDownloadUrl(sessionId: string, format: 'docx' | 'pdf'): Promise<{ url: string }> {
  return req(`/sessions/${sessionId}/download/${format}`);
}

// ── SSE ───────────────────────────────────────────────────────────────────────

export function connectSSE(sessionId: string, onStatus: (status: string) => void): () => void {
  const es = new EventSource(`${API}/sessions/${sessionId}/stream`);
  es.onmessage = (e) => {
    try { onStatus(JSON.parse(e.data as string).status as string); } catch { /* ignore */ }
  };
  es.onerror = () => es.close();
  return () => es.close();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionStatus = 'UPLOADED' | 'PARSING' | 'INVENTORY_REVIEW' | 'OPTIMISING' | 'READY' | 'FAILED';

export interface SessionData {
  id: string;
  status: SessionStatus;
  inventory?: CandidateInventory;
  inventoryConfirmed: boolean;
  jobDescription?: string;
  matchReport?: MatchReport;
  repositionPlan?: RepositionPlan;
  integrityReport?: IntegrityReport;
  userDecisions?: Record<string, Decision>;
  templateId?: string;
  outputDocxKey?: string;
  outputPdfKey?: string;
}

export interface CandidateInventory {
  contact: { name: string; email?: string; phone?: string; links: string[] };
  summary_raw?: string;
  experiences: Experience[];
  skills: Skill[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  confirmed: boolean;
}

export interface Experience {
  id: string; company: string; title: string; start: string; end: string;
  bullets: Bullet[]; confidence?: number; origin: string;
}
export interface Bullet {
  id: string; text: string; entities: EntitySet; confidence?: number; origin: string;
}
export interface EntitySet { skills: string[]; tools: string[]; metrics: string[]; actions: string[]; }
export interface Skill { id: string; name: string; proficiency_stated: string; confidence?: number; origin: string; }
export interface Project { id: string; name: string; description?: string; bullets: Bullet[]; }
export interface Education { id: string; institution: string; degree: string; field?: string; start?: string; end?: string; }
export interface Certification { id: string; name: string; issuer?: string; status: string; date?: string; }

export interface RepositionPlan {
  summary: { text: string; source_ids: string[]; change_type: string };
  experiences_order: string[];
  bullets: RewrittenBullet[];
  surfaced_skills: SurfacedSkill[];
  skills_order: string[];
  dropped: string[];
}
export interface RewrittenBullet {
  source_id: string; original: string; rewritten: string; change_type: string; rationale: string; validated: boolean;
}
export interface SurfacedSkill { skill_name: string; source_id: string; change_type: string; }

export interface MatchReport {
  must_have: RequirementCoverage[]; nice_to_have: RequirementCoverage[]; match_score: number; gaps: string[];
}
export interface RequirementCoverage {
  requirement: string; bucket: 'covered' | 'latent' | 'gap'; source_ids: string[]; match_rule: string;
}

export interface IntegrityReport {
  results: ValidationResult[];
  ai_change_summary: { repositioned: number; reworded: number; surfaced: number; implied: number; fabricated: number };
  user_change_summary: { attested: number; edited: number };
}
export interface ValidationResult { unit_id: string; result: 'pass' | 'fail'; reason?: string; }

export interface Decision { sourceId: string; action: 'accept' | 'reject' | 'edit'; editedText?: string; }
export interface InventoryEdit { id: string; field: string; value: unknown; }
export interface Attestation { name: string; category: 'skill' | 'tool' | 'certification'; }
export interface Template { id: string; name: string; description: string; atsRisk: string; }
