import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { Alert } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { SystemScreen } from '@/components/system/SystemScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.system.sessionExpired.title };

/** SYS-005 — Session expiree. */
export default function SessionExpiredPage() {
  return (
    <SystemScreen
      title={fr.system.sessionExpired.title}
      body={fr.system.sessionExpired.body}
      correlationId={newCorrelationId()}
      icon={<RotateCw size={28} aria-hidden="true" />}
      details={
        <div className="flex w-full flex-col gap-4 text-left">
          <Alert variant="warning" title={fr.system.sessionExpired.reason} />
          <Alert variant="success" title="Ce qui est conservé">
            {fr.system.sessionExpired.kept}
          </Alert>
          <Alert variant="info" title="Sécurité">
            {fr.system.sessionExpired.securityNote}
          </Alert>
        </div>
      }
      actions={
        <>
          <Link
            href={ROUTES.signIn}
            className="rounded-base bg-primary text-body text-primary-foreground hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[48px] items-center px-7 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.system.sessionExpired.primary}
          </Link>
          <Link
            href={ROUTES.dashboard}
            className="rounded-base bg-surface text-body text-text-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[48px] items-center border border-[#CBD5E1] px-7 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.system.sessionExpired.secondary}
          </Link>
        </>
      }
    />
  );
}
