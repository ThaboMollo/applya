'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { connectSSE, getSession, SessionStatus } from '@/lib/api';

const PHASE_A_STEPS: { status: string; label: string; desc: string }[] = [
  { status: 'PARSING',    label: 'Parsing resume',         desc: 'Extracting text and structure from your document' },
  { status: 'EXTRACTING', label: 'Building your inventory', desc: 'Identifying skills, experience, metrics, and more' },
  { status: 'INVENTORY_REVIEW', label: 'Ready for your review', desc: 'We extracted your inventory — please confirm it' },
];

const PHASE_B_STEPS: { status: string; label: string; desc: string }[] = [
  { status: 'ANALYSING_JD',  label: 'Analysing job description', desc: 'Extracting requirements and keywords' },
  { status: 'MATCHING',      label: 'Matching your profile',     desc: 'Finding covered skills, latent evidence, and gaps' },
  { status: 'REPOSITIONING', label: 'Repositioning resume',      desc: 'Reordering and rephrasing using only your facts' },
  { status: 'VALIDATING',    label: 'Validating integrity',      desc: 'Checking every claim is sourced to your inventory' },
  { status: 'VERIFYING',     label: 'Verifying changes',         desc: 'LLM judge reviewing each rewritten bullet' },
  { status: 'RENDERING',     label: 'Generating documents',      desc: 'Creating your DOCX and PDF in chosen template' },
  { status: 'READY',         label: 'Ready!',                    desc: 'Your repositioned resume is ready to review' },
];

type StepState = 'pending' | 'active' | 'done' | 'failed';

function getStepState(stepStatus: string, currentStatus: string, isFailed: boolean): StepState {
  if (isFailed) return stepStatus === currentStatus ? 'failed' : 'pending';
  const allStatuses = [...PHASE_A_STEPS, ...PHASE_B_STEPS].map((s) => s.status);
  const stepIdx = allStatuses.indexOf(stepStatus);
  const currentIdx = allStatuses.indexOf(currentStatus);
  if (currentIdx < 0) return 'pending';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export default function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<string>('PARSING');
  const [phase, setPhase] = useState<'A' | 'B'>('A');

  useEffect(() => {
    // Poll session status every 3s as fallback alongside SSE
    async function poll() {
      try {
        const session = await getSession(id);
        handleStatus(session.status);
      } catch { /* ignore */ }
    }

    const interval = setInterval(poll, 3000);
    poll();

    const disconnect = connectSSE(id, handleStatus);

    return () => { clearInterval(interval); disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleStatus(s: string) {
    setStatus(s);
    const phaseADone = ['OPTIMISING', 'ANALYSING_JD', 'MATCHING', 'REPOSITIONING', 'VALIDATING', 'VERIFYING', 'RENDERING', 'READY'].includes(s);
    if (phaseADone) setPhase('B');

    if (s === 'INVENTORY_REVIEW') {
      router.push(`/sessions/${id}/inventory`);
    } else if (s === 'READY') {
      router.push(`/sessions/${id}/review`);
    }
  }

  const isFailed = status === 'FAILED';
  const steps = phase === 'A' ? PHASE_A_STEPS : PHASE_B_STEPS;
  const phaseLabel = phase === 'A' ? 'Phase A — Extracting your inventory' : 'Phase B — Repositioning your resume';

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">FitCV</span>
      </nav>

      <div className="page-center">
        <div className="container">
          <div className="card mt-8">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-6">
                {!isFailed && <div className="spinner" />}
                <div>
                  <div className="heading-md">{phaseLabel}</div>
                  <div className="text-sm text-muted">This usually takes 10–40 seconds</div>
                </div>
              </div>

              <div className="steps">
                {steps.map((step) => {
                  const state = getStepState(step.status, status, isFailed);
                  return (
                    <div key={step.status} className="step">
                      <div className={`step-indicator step-${state}`}>
                        {state === 'done' ? '✓' : state === 'failed' ? '✗' : ''}
                      </div>
                      <div>
                        <div style={{ fontWeight: state === 'active' ? 600 : 400, fontSize: 14 }}>{step.label}</div>
                        {state === 'active' && <div className="text-sm text-muted">{step.desc}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isFailed && (
                <div className="badge badge-red mt-6" style={{ padding: '12px 16px', borderRadius: 8 }}>
                  <strong>Processing failed.</strong> Please go back and try again.
                </div>
              )}

              {isFailed && (
                <div className="mt-4">
                  <a href="/" className="btn btn-secondary">← Start over</a>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-muted text-center mt-4">
            Session ID: <code style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
