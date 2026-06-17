'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSession, saveDecisions, SessionData, RewrittenBullet,
  Decision, CandidateInventory, RepositionPlan, IntegrityReport, MatchReport,
} from '@/lib/api';

type DecisionMap = Record<string, { action: 'accept' | 'reject' | 'edit'; editedText?: string }>;

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await getSession(id);
      if (s.status !== 'READY') { router.push(`/sessions/${id}/processing`); return; }
      setSession(s);
      // Init decisions — default all to accept
      const initial: DecisionMap = {};
      s.repositionPlan?.bullets.forEach((b) => { initial[b.source_id] = { action: 'accept' }; });
      setDecisions(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function setDecision(sourceId: string, action: 'accept' | 'reject') {
    setDecisions((prev) => ({ ...prev, [sourceId]: { action } }));
  }

  function startEdit(bullet: RewrittenBullet) {
    setEditingId(bullet.source_id);
    setEditText(bullet.rewritten);
  }

  function saveEdit(sourceId: string) {
    setDecisions((prev) => ({ ...prev, [sourceId]: { action: 'edit', editedText: editText } }));
    setEditingId(null);
  }

  async function handleSaveAndExport() {
    setSaving(true);
    try {
      const decisionList: Decision[] = Object.entries(decisions).map(([sourceId, d]) => ({
        sourceId, action: d.action, editedText: d.editedText,
      }));
      await saveDecisions(id, decisionList);
      router.push(`/sessions/${id}/export`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save decisions');
      setSaving(false);
    }
  }

  if (loading) return <LoadingPage />;
  if (!session) return <div className="page-center"><div className="text-muted">{error || 'Session not found'}</div></div>;

  const plan = session.repositionPlan as RepositionPlan;
  const inv = session.inventory as CandidateInventory;
  const integrity = session.integrityReport as IntegrityReport;
  const matchReport = session.matchReport as MatchReport;

  const accepted = Object.values(decisions).filter((d) => d.action === 'accept').length;
  const rejected = Object.values(decisions).filter((d) => d.action === 'reject').length;
  const edited = Object.values(decisions).filter((d) => d.action === 'edit').length;

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">FitCV</span>
        <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
          <span className="badge badge-green">{accepted} accepted</span>
          <span className="badge badge-red">{rejected} rejected</span>
          {edited > 0 && <span className="badge badge-blue">{edited} edited</span>}
        </div>
      </nav>

      <div className="container-wide" style={{ padding: '32px 24px' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="heading-lg mb-1">Review your repositioned resume</h1>
            <p className="text-muted">Accept, reject, or edit each change. Only accepted changes go into your final document.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleSaveAndExport} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : 'Save & export →'}
          </button>
        </div>

        {error && <div className="badge badge-red mb-4" style={{ padding: '10px 14px', borderRadius: 8 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          {/* Main diff area */}
          <div>
            {/* Summary */}
            {plan.summary && (
              <div className="card mb-6">
                <div className="card-body">
                  <div className="heading-sm mb-3">Professional Summary</div>
                  <div className="diff-pair">
                    <div>
                      <div className="heading-sm mb-2">Original</div>
                      <div className="diff-cell diff-original">{inv.summary_raw || '(no original summary)'}</div>
                    </div>
                    <div>
                      <div className="heading-sm mb-2">Repositioned</div>
                      <div className="diff-cell diff-rewritten">{plan.summary.text}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bullets by experience */}
            {inv.experiences.map((exp) => {
              const expBullets = plan.bullets.filter((b) =>
                exp.bullets.some((eb) => eb.id === b.source_id)
              );
              if (expBullets.length === 0) return null;
              return (
                <div key={exp.id} className="card mb-6">
                  <div className="card-body">
                    <div className="flex justify-between items-center mb-1">
                      <div className="heading-md">{exp.title} · {exp.company}</div>
                      <div className="text-sm text-muted">{exp.start} – {exp.end}</div>
                    </div>
                    <hr className="divider" style={{ margin: '12px 0' }} />

                    {expBullets.map((bullet) => {
                      const dec = decisions[bullet.source_id] ?? { action: 'accept' };
                      const isUnchanged = bullet.change_type === 'unchanged' || bullet.original === bullet.rewritten;
                      const isEditing = editingId === bullet.source_id;

                      return (
                        <div key={bullet.source_id} className="mb-4">
                          {isUnchanged ? (
                            <div className="diff-cell diff-unchanged" style={{ marginBottom: 6 }}>
                              {bullet.original}
                              <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: 11 }}>unchanged</span>
                            </div>
                          ) : (
                            <div className="diff-pair">
                              <div>
                                <div className="heading-sm mb-2">Original</div>
                                <div className={`diff-cell ${dec.action === 'reject' ? 'diff-rewritten' : 'diff-original'}`}>
                                  {bullet.original}
                                </div>
                              </div>
                              <div>
                                <div className="heading-sm mb-2">
                                  Repositioned
                                  <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>
                                    {bullet.change_type}
                                  </span>
                                </div>
                                {isEditing ? (
                                  <div>
                                    <textarea
                                      className="textarea"
                                      style={{ minHeight: 80 }}
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <button className="btn btn-sm btn-primary" onClick={() => saveEdit(bullet.source_id)}>Save edit</button>
                                      <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`diff-cell ${dec.action === 'reject' ? 'diff-original' : dec.action === 'edit' ? 'diff-rewritten' : 'diff-rewritten'}`}>
                                    {dec.action === 'edit' && dec.editedText ? dec.editedText : bullet.rewritten}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {!isUnchanged && !isEditing && (
                            <div className="flex gap-2 mt-2">
                              <button
                                className={`btn btn-sm ${dec.action === 'accept' ? 'btn-success' : 'btn-ghost'}`}
                                onClick={() => setDecision(bullet.source_id, 'accept')}
                              >
                                ✓ Accept
                              </button>
                              <button
                                className={`btn btn-sm ${dec.action === 'reject' ? 'btn-danger' : 'btn-ghost'}`}
                                onClick={() => setDecision(bullet.source_id, 'reject')}
                              >
                                ✗ Reject
                              </button>
                              <button className="btn btn-sm btn-ghost" onClick={() => startEdit(bullet)}>
                                ✎ Edit
                              </button>
                              <div className="text-sm text-muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                                {bullet.rationale}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Surfaced skills */}
            {plan.surfaced_skills.length > 0 && (
              <div className="card mb-6">
                <div className="card-body">
                  <div className="heading-md mb-3">Skills we&apos;re surfacing from your experience</div>
                  <p className="text-sm text-muted mb-3">
                    These skills appear in your bullets or are implied by your tools — not invented.
                  </p>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {plan.surfaced_skills.map((s) => (
                      <span key={s.skill_name} className="badge badge-blue">
                        {s.skill_name}
                        <span style={{ fontSize: 10, opacity: .7 }}> ({s.change_type})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ position: 'sticky', top: 24 }}>
            {/* Match score */}
            {matchReport && (
              <div className="card mb-4">
                <div className="card-body text-center">
                  <div className="heading-sm mb-3">Match score</div>
                  <MatchScoreRing score={matchReport.match_score} />
                  <div className="text-sm text-muted mt-3">
                    {matchReport.must_have.filter((r) => r.bucket !== 'gap').length} / {matchReport.must_have.length} must-haves covered
                  </div>
                </div>
              </div>
            )}

            {/* Integrity badge */}
            {integrity && (
              <div className="card mb-4">
                <div className="card-body">
                  <div className="heading-sm mb-3">Integrity report</div>
                  <div className="integrity-badge">
                    <div className="integrity-stat">
                      <div className="integrity-stat-value">{integrity.ai_change_summary.fabricated}</div>
                      <div className="integrity-stat-label">Fabricated</div>
                    </div>
                    <div className="integrity-stat">
                      <div className="integrity-stat-value" style={{ color: 'var(--primary)' }}>
                        {integrity.ai_change_summary.reworded}
                      </div>
                      <div className="integrity-stat-label">Reworded</div>
                    </div>
                    <div className="integrity-stat">
                      <div className="integrity-stat-value" style={{ color: 'var(--primary)' }}>
                        {integrity.ai_change_summary.surfaced}
                      </div>
                      <div className="integrity-stat-label">Surfaced</div>
                    </div>
                  </div>
                  {integrity.user_change_summary.attested > 0 && (
                    <div className="text-sm text-muted mt-3">
                      Your changes: {integrity.user_change_summary.attested} attested skill{integrity.user_change_summary.attested !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Honest gaps */}
            {matchReport && matchReport.gaps.length > 0 && (
              <div className="card mb-4">
                <div className="card-body">
                  <div className="heading-sm mb-1">Honest gaps</div>
                  <p className="text-sm text-muted mb-3">
                    The job wants these — your resume shows no evidence. Not injected.
                  </p>
                  <div className="gaps-panel">
                    {matchReport.gaps.map((g) => (
                      <div key={g} className="gap-item">
                        <div className="gap-bullet" />
                        <span className="text-sm">{g}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted mt-3">
                    Address these honestly if you have relevant experience, or be ready to discuss them.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchScoreRing({ score }: { score: number }) {
  const r = 36; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="match-score-ring" style={{ display: 'inline-block', position: 'relative' }}>
      <svg width={90} height={90} viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="match-score-value" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color }}>
        {score}%
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="page">
      <nav className="nav"><span className="nav-logo">FitCV</span></nav>
      <div className="page-center"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
    </div>
  );
}
