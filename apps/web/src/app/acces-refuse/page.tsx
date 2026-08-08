import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Alert } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { SystemScreen } from '@/components/system/SystemScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.system.accessDenied.title };

/** SYS-006 — Acces refuse (droits insuffisants). */
export default function AccessDeniedPage() {
  return (
    <SystemScreen
      title={fr.system.accessDenied.title}
      body={fr.system.accessDenied.body}
      correlationId={newCorrelationId()}
      icon={<ShieldAlert size={28} aria-hidden="true" />}
      details={
        <div className="w-full text-left">
          <Alert variant="info" title="Pourquoi ce message ?">
            {fr.system.accessDenied.hint}
          </Alert>
        </div>
      }
      actions={
        <Link
          href={ROUTES.dashboard}
          className="rounded-base bg-primary text-body text-primary-foreground hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[48px] items-center px-7 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {fr.system.accessDenied.primary}
        </Link>
      }
    />
  );
}
