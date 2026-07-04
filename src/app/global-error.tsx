'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, Arial, sans-serif' }}>
          <section style={{ width: '100%', maxWidth: 420, border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ margin: '0 auto 16px', display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 12, background: '#fef2f2', color: '#b91c1c' }}>
              <AlertTriangle size={24} />
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>InstructorOS could not load</h1>
            <p style={{ color: '#64748b', lineHeight: 1.6 }}>
              Refresh this page. If it continues, check hosting environment variables and deployment logs.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, border: 0, background: '#111827', color: 'white', padding: '0 18px', fontWeight: 800 }}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
