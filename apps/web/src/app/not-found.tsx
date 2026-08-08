import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { ClientCorrelationId } from '@/components/system/ClientCorrelationId';

export const metadata = { title: fr.system.notFound.title };

/** SYS-001 — Page introuvable. */
export default function NotFound() {
  return (
    <ClientCorrelationId
      code={fr.system.notFound.code}
      title={fr.system.notFound.title}
      body={fr.system.notFound.body}
      icon={<SearchX size={28} aria-hidden="true" />}
      actions={
        <Link
          href={ROUTES.dashboard}
          className="rounded-base bg-primary text-body text-primary-foreground hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[48px] items-center px-7 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {fr.system.notFound.primary}
        </Link>
      }
    />
  );
}
