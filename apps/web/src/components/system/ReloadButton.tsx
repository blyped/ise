'use client';

import { Button } from '@ise/ui-web';

/**
 * « Réessayer » des ecrans SYS-003 / SYS-004 : recharge la page courante.
 * Si la fenetre de maintenance est terminee, l'ecran normal revient ;
 * sinon, l'ecran de maintenance se raffiche — rien n'est simule.
 */
export function ReloadButton({ label }: { label: string }) {
  return (
    <Button size="lg" type="button" onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
