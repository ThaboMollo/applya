'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';

export default function SessionRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    getSession(id)
      .then((session) => {
        switch (session.status) {
          case 'INVENTORY_REVIEW':
            router.replace(`/sessions/${id}/inventory`);
            break;
          case 'READY':
            router.replace(`/sessions/${id}/review`);
            break;
          default:
            router.replace(`/sessions/${id}/processing`);
        }
      })
      .catch(() => router.replace('/'));
  }, [id, router]);

  return (
    <div className="page">
      <nav className="nav"><span className="nav-logo">FitCV</span></nav>
      <div className="page-center">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    </div>
  );
}
