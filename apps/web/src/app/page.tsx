'use client';

import { useRef, useState, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { uploadResume, attachJob } from '@/lib/api';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function acceptFile(f: File) {
    const ok = f.type.includes('pdf') || f.type.includes('wordprocessingml') || f.name.endsWith('.docx');
    if (!ok) { setError('Only PDF and DOCX files are supported.'); return; }
    setFile(f);
    setError('');
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }

  async function handleSubmit() {
    if (!file) { setError('Please upload your resume.'); return; }
    if (jd.trim().length < 50) { setError('Job description is too short (minimum 50 characters).'); return; }
    setLoading(true); setError('');
    try {
      const { sessionId } = await uploadResume(file);
      await attachJob(sessionId, jd.trim());
      router.push(`/sessions/${sessionId}/processing`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">FitCV</span>
        <span className="nav-tagline">Honest resume positioning</span>
      </nav>

      <div className="page-center">
        <div className="container">
          <div className="text-center mt-8 mb-8">
            <h1 className="heading-xl mb-2">Position your resume, honestly</h1>
            <p className="text-muted" style={{ fontSize: 16 }}>
              We reorder and rephrase what&apos;s already there. We never invent a single fact.
            </p>
          </div>

          <div className="card">
            <div className="card-body flex-col gap-6">
              <div className="form-group">
                <label className="label">Your resume (PDF or DOCX)</label>
                <div
                  className={`dropzone${dragging ? ' active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                  />
                  {file ? (
                    <div className="flex-col gap-2" style={{ alignItems: 'center' }}>
                      <div style={{ fontSize: 24 }}>📄</div>
                      <div style={{ fontWeight: 500 }}>{file.name}</div>
                      <div className="text-sm text-muted">{(file.size / 1024).toFixed(0)} KB — click to change</div>
                    </div>
                  ) : (
                    <div className="flex-col gap-2" style={{ alignItems: 'center' }}>
                      <div className="dropzone-icon">📂</div>
                      <div style={{ fontWeight: 500 }}>Drop your resume here, or click to browse</div>
                      <div className="text-sm text-muted">PDF or DOCX, max 10 MB</div>
                    </div>
                  )}
                </div>
              </div>

              <hr className="divider" style={{ margin: '0' }} />

              <div className="form-group">
                <label className="label" htmlFor="jd">Target job description</label>
                <p className="text-sm text-muted mb-2">Paste the full job posting — the more detail, the better the match.</p>
                <textarea
                  id="jd"
                  className="textarea"
                  style={{ minHeight: 200 }}
                  placeholder="Paste the job description here…"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                />
                <div className="text-sm text-muted text-right">{jd.length} characters</div>
              </div>

              {error && (
                <div className="badge badge-red" style={{ padding: '10px 14px', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Uploading…</>
                  : 'Analyse my resume →'}
              </button>
            </div>
          </div>

          <p className="text-sm text-muted text-center mt-6">
            Your resume is processed privately. No data is sold or shared. Auto-deleted in 30 days.
          </p>
        </div>
      </div>
    </div>
  );
}
