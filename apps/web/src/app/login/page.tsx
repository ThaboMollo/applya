'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">FitCV</span>
      </nav>

      <div className="page-center">
        <div className="container">
          <div className="card" style={{ maxWidth: 440, margin: '0 auto' }}>
            <div className="card-body text-center flex-col gap-4" style={{ alignItems: 'center' }}>
              <div style={{ fontSize: 40 }}>✉️</div>
              <h1 className="heading-lg">Check your email</h1>
              <p className="text-muted">
                FitCV is invite-only during the pilot. If you received an invitation,
                click the magic link in that email to sign in.
              </p>

              {error === 'auth_failed' && (
                <div className="badge badge-red" style={{ padding: '10px 14px', borderRadius: 8 }}>
                  The sign-in link has expired or is invalid. Please request a new invite.
                </div>
              )}

              <p className="text-sm text-muted">
                No invite yet? Contact{' '}
                <a href="mailto:mollo.t.mponya@gmail.com" style={{ color: 'var(--primary)' }}>
                  mollo.t.mponya@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
