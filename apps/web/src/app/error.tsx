'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { newCorrelationId } from '@/lib/correlation';
import { SystemScreen } from '@/components/system/SystemScreen';

/**
 * SYS-002 — Erreur systeme.
 * `error.digest` est l'identifiant produit par Next cote serveur : il permet
 * de retrouver la trace dans les journaux sans jamais l'exposer ici (D-102).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisation cote client volontairement minimale : pas de donnee personnelle.
    console.error('[ISE] erreur applicative', error.digest ?? 'sans digest');
  }, [error]);

  const correlationId = error.digest ?? newCorrelationId();

  return (
    <SystemScreen
      code={fr.system.serverError.code}
      title={fr.system.serverError.title}
      body={fr.system.serverError.body}
      correlationId={correlationId}
      icon={<TriangleAlert size={28} aria-hidden="true" />}
      actions={
        <>
          <Button size="lg" onClick={reset}>
            {fr.system.serverError.primary}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            {fr.system.serverError.secondary}
          </Button>
        </>
      }
    />
  );
}
