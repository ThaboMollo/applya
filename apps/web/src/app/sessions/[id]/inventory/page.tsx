'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getInventory, patchInventory, confirmInventory, CandidateInventory, Skill } from '@/lib/api';

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [inventory, setInventory] = useState<CandidateInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [attestInput, setAttestInput] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getInventory(id);
      setInventory(data.inventory);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAttest() {
    const name = attestInput.trim();
    if (!name) return;
    try {
      const res = await patchInventory(id, { attestations: [{ name, category: 'skill' }] });
      setInventory((res as { inventory: CandidateInventory }).inventory);
      setAttestInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to attest skill');
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      await confirmInventory(id);
      router.push(`/sessions/${id}/processing`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm inventory');
      setConfirming(false);
    }
  }

  function confClass(confidence?: number) {
    if (!confidence) return '';
    if (confidence >= 0.8) return 'conf-high';
    if (confidence >= 0.6) return 'conf-mid';
    return 'conf-low';
  }

  function confLabel(confidence?: number) {
    if (!confidence || confidence >= 0.8) return '';
    if (confidence >= 0.6) return 'medium confidence';
    return 'low confidence — please verify';
  }

  if (loading) return <LoadingPage />;

  const inv = inventory!;
  const lowConfSkills = inv.skills.filter((s) => (s.confidence ?? 1) < 0.7);
  const attestedSkills = inv.skills.filter((s) => s.origin === 'attested');

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">FitCV</span>
        <span className="badge badge-yellow" style={{ marginLeft: 8 }}>Your turn — review required</span>
      </nav>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="heading-lg mb-2">Confirm your extracted inventory</h1>
          <p className="text-muted">
            We extracted this from your resume. Review it carefully — this is the source of truth
            for everything we generate. Nothing is created until you confirm.
          </p>
          {lowConfSkills.length > 0 && (
            <div className="badge badge-yellow mt-4" style={{ padding: '10px 14px', borderRadius: 8 }}>
              ⚠️ <strong>{lowConfSkills.length} items</strong> have low extraction confidence — please verify them below.
            </div>
          )}
        </div>

        {error && <div className="badge badge-red mb-4" style={{ padding: '10px 14px', borderRadius: 8 }}>{error}</div>}

        {/* Skills */}
        <div className="inv-section">
          <div className="inv-section-title">
            <div className="heading-md">Skills</div>
            <div className="badge badge-gray">{inv.skills.length}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {inv.skills.map((s: Skill) => (
              <span
                key={s.id}
                className={`badge ${s.origin === 'attested' ? 'badge-blue' : (s.confidence ?? 1) < 0.7 ? 'badge-yellow' : 'badge-gray'}`}
                title={confLabel(s.confidence) || (s.origin === 'attested' ? 'You attested this' : '')}
              >
                {s.origin === 'attested' && '✓ '}
                {s.name}
                {s.proficiency_stated !== 'none' && ` (${s.proficiency_stated})`}
              </span>
            ))}
          </div>

          {/* Attestation */}
          <div className="mt-4 flex gap-2">
            <input
              className="input"
              style={{ maxWidth: 280 }}
              placeholder="Add a skill I actually have…"
              value={attestInput}
              onChange={(e) => setAttestInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAttest()}
            />
            <button className="btn btn-secondary" onClick={handleAttest} disabled={!attestInput.trim()}>
              Attest →
            </button>
          </div>
          {attestedSkills.length > 0 && (
            <p className="text-sm text-muted mt-2">
              Attested skills are tagged as your personal confirmation — shown separately in the integrity badge.
            </p>
          )}
        </div>

        {/* Experience */}
        {inv.experiences.length > 0 && (
          <div className="inv-section">
            <div className="inv-section-title">
              <div className="heading-md">Experience</div>
              <div className="badge badge-gray">{inv.experiences.length} roles</div>
            </div>
            {inv.experiences.map((exp) => (
              <div key={exp.id} className="card mb-4">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-1">
                    <div className="heading-md">{exp.title}</div>
                    <div className="text-sm text-muted">{exp.start} – {exp.end}</div>
                  </div>
                  <div className="text-muted mb-3">{exp.company}</div>
                  {exp.bullets.map((b) => (
                    <div key={b.id} className={`inv-item${(b.confidence ?? 1) < 0.7 ? ' inv-item-low' : ''}`}>
                      <div className={`conf-dot ${confClass(b.confidence)}`} title={confLabel(b.confidence)} />
                      <div className="inv-item-body">
                        <div className="inv-item-text">{b.text}</div>
                        {b.entities.skills.length > 0 && (
                          <div className="inv-item-meta">
                            Skills: {b.entities.skills.join(', ')}
                            {b.entities.metrics.length > 0 && ` · Metrics: ${b.entities.metrics.join(', ')}`}
                          </div>
                        )}
                        {(b.confidence ?? 1) < 0.7 && (
                          <div className="badge badge-yellow mt-2" style={{ fontSize: 11 }}>Low confidence — verify this bullet</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {inv.projects.length > 0 && (
          <div className="inv-section">
            <div className="inv-section-title">
              <div className="heading-md">Projects</div>
              <div className="badge badge-gray">{inv.projects.length}</div>
            </div>
            {inv.projects.map((proj) => (
              <div key={proj.id} className="inv-item">
                <div className="inv-item-body">
                  <div style={{ fontWeight: 500 }}>{proj.name}</div>
                  {proj.description && <div className="text-sm text-muted">{proj.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {inv.education.length > 0 && (
          <div className="inv-section">
            <div className="inv-section-title">
              <div className="heading-md">Education</div>
            </div>
            {inv.education.map((edu) => (
              <div key={edu.id} className="inv-item">
                <div className="inv-item-body">
                  <div style={{ fontWeight: 500 }}>{edu.institution}</div>
                  <div className="text-sm text-muted">{edu.degree}{edu.field ? `, ${edu.field}` : ''}{edu.end ? ` · ${edu.end}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {inv.certifications.length > 0 && (
          <div className="inv-section">
            <div className="inv-section-title"><div className="heading-md">Certifications</div></div>
            {inv.certifications.map((cert) => (
              <div key={cert.id} className="inv-item">
                <div className="inv-item-body">
                  <div style={{ fontWeight: 500 }}>{cert.name}</div>
                  <div className="text-sm text-muted">{cert.issuer}{cert.date ? ` · ${cert.date}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirm CTA */}
        <div className="card" style={{ position: 'sticky', bottom: 24, background: 'var(--surface)' }}>
          <div className="card-body">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="heading-sm mb-1">Everything looks right?</div>
                <div className="text-sm text-muted">Confirming locks this inventory. The AI will only use these facts.</div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleConfirm}
                disabled={confirming}
                style={{ whiteSpace: 'nowrap' }}
              >
                {confirming ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Confirming…</> : 'Confirm & optimise →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="page">
      <nav className="nav"><span className="nav-logo">FitCV</span></nav>
      <div className="page-center">
        <div className="flex-col gap-4" style={{ alignItems: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <div className="text-muted">Loading inventory…</div>
        </div>
      </div>
    </div>
  );
}
