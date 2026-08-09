'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { fr } from '@/i18n/fr';
import { newCorrelationId } from '@/lib/correlation';
import './globals.css';

/**
 * SYS-002 — dernier filet de securite : le gabarit racine lui-meme a echoue.
 * Le balisage est autonome (html / body) et n'utilise aucun composant qui
 * pourrait etre a l'origine de la panne.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const correlationId = error.digest ?? newCorrelationId();

  // Le rendu racine ayant echoue, `onRequestError` (instrumentation.ts) ne
  // couvre pas forcement ce cas cote client : capture explicite ici, avec
  // le meme identifiant de correlation que celui affiche a l'ecran.
  useEffect(() => {
    Sentry.captureException(error, { tags: { correlationId } });
  }, [error, correlationId]);

  return (
    <html lang="fr">
      <body
        style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#F7F9FC' }}
      >
        <main
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '56px 20px',
            textAlign: 'center',
            color: '#0F172A',
          }}
        >
          <p style={{ fontSize: 64, fontWeight: 700, margin: 0, color: '#0B214A' }}>
            {fr.system.serverError.code}
          </p>
          <h1 style={{ fontSize: 32, margin: '12px 0' }}>{fr.system.serverError.title}</h1>
          <p style={{ color: '#475569' }}>{fr.system.serverError.body}</p>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 24 }}>
            {fr.common.correlationLabel} : <code>{correlationId}</code>
          </p>
          <p style={{ marginTop: 24 }}>
            <a href="/" style={{ color: '#1D4ED8' }}>
              {fr.system.serverError.secondary}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
