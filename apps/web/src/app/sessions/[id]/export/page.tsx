'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { getTemplates, triggerExport, getDownloadUrl, Template } from '@/lib/api';

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState('classic');
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [docxUrl, setDocxUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getTemplates(id);
      setTemplates(res.templates);
      setSelected(res.default);
    } catch {
      setTemplates([
        { id: 'classic', name: 'Classic', description: 'Single-column, ATS-safest', atsRisk: 'low' },
        { id: 'modern',  name: 'Modern',  description: 'Single-column with accent colour', atsRisk: 'low' },
        { id: 'compact', name: 'Compact', description: 'Denser single-column for longer CVs', atsRisk: 'low' },
      ]);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    setExporting(true); setError('');
    try {
      await triggerExport(id, selected, 'docx');
      const [docx, pdf] = await Promise.all([
        getDownloadUrl(id, 'docx'),
        getDownloadUrl(id, 'pdf'),
      ]);
      setDocxUrl(docx.url);
      setPdfUrl(pdf.url);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const templatePreviews: Record<string, { nameColor: string; lineColor: string }> = {
    classic: { nameColor: '#000', lineColor: '#000' },
    modern:  { nameColor: '#2563EB', lineColor: '#2563EB' },
    compact: { nameColor: '#000', lineColor: '#000' },
  };

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">FitCV</span>
        <a href={`/sessions/${id}/review`} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
          ← Back to review
        </a>
      </nav>

      <div className="container" style={{ padding: '40px 24px' }}>
        <h1 className="heading-lg mb-2">Choose your template</h1>
        <p className="text-muted mb-8">All templates are ATS-safe single-column formats. The content is identical — only the presentation changes.</p>

        {error && <div className="badge badge-red mb-6" style={{ padding: '10px 14px', borderRadius: 8 }}>{error}</div>}

        {!done ? (
          <>
            <div className="template-grid mb-8">
              {templates.map((t) => {
                const preview = templatePreviews[t.id] ?? templatePreviews.classic;
                return (
                  <div
                    key={t.id}
                    className={`template-card${selected === t.id ? ' selected' : ''}`}
                    onClick={() => setSelected(t.id)}
                  >
                    {/* Mini preview */}
                    <div className="template-preview">
                      <div style={{ padding: '12px 10px' }}>
                        <div style={{ background: preview.nameColor, height: 6, width: '60%', borderRadius: 2, margin: '0 auto 6px' }} />
                        <div style={{ background: '#ccc', height: 3, width: '80%', borderRadius: 1, margin: '0 auto 10px' }} />
                        <div style={{ background: preview.lineColor, height: 3, width: '100%', borderRadius: 1, marginBottom: 6 }} />
                        {[70, 85, 60, 75].map((w, i) => (
                          <div key={i} style={{ background: '#ddd', height: 3, width: `${w}%`, borderRadius: 1, marginBottom: 4, marginLeft: i > 0 ? 8 : 0 }} />
                        ))}
                        <div style={{ background: preview.lineColor, height: 3, width: '100%', borderRadius: 1, margin: '10px 0 6px' }} />
                        {[80, 65, 90].map((w, i) => (
                          <div key={i} style={{ background: '#ddd', height: 3, width: `${w}%`, borderRadius: 1, marginBottom: 4, marginLeft: i > 0 ? 8 : 0 }} />
                        ))}
                      </div>
                    </div>

                    <div className="heading-md mb-1">{t.name}</div>
                    <div className="text-sm text-muted mb-2">{t.description}</div>
                    <div className="badge badge-green" style={{ fontSize: 11 }}>ATS safe</div>
                    {selected === t.id && (
                      <div className="badge badge-blue mt-2" style={{ fontSize: 11 }}>Selected</div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              className="btn btn-primary btn-lg w-full"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting
                ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Generating documents…</>
                : `Generate ${templates.find((t) => t.id === selected)?.name ?? selected} resume →`}
            </button>
          </>
        ) : (
          <div className="card">
            <div className="card-body text-center flex-col gap-4" style={{ alignItems: 'center' }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <h2 className="heading-lg">Your resume is ready</h2>
              <p className="text-muted">
                Repositioned honestly — {0} facts fabricated, everything sourced to your original resume.
              </p>

              <div className="flex gap-3 mt-4">
                <a
                  href={docxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-lg"
                >
                  ⬇ Download DOCX
                </a>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-lg"
                >
                  ⬇ Download PDF
                </a>
              </div>

              <hr className="divider w-full" />

              <div className="flex gap-3">
                <button className="btn btn-ghost" onClick={() => { setDone(false); setExporting(false); }}>
                  Change template
                </button>
                <a href="/" className="btn btn-ghost">New resume →</a>
              </div>

              <p className="text-sm text-muted mt-2">
                Download links expire in 1 hour. Your files are auto-deleted in 30 days.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
