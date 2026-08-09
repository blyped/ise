import Link from 'next/link';
import { frAdminData } from '@/i18n/admin-data';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';

/**
 * En-tête des écrans du lot « données ». Le fil d'Ariane remonte vers la
 * racine `/administration` (lot « cœur ») : aucune navigation générale
 * n'est construite ici — elle appartient au layout commun.
 */
export function AdminPageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  backHref?: string | undefined;
  backLabel?: string | undefined;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      <nav aria-label={frAdminData.brand.breadcrumb} className="text-caption text-text-muted">
        <Link
          href={backHref ?? ADMIN_DATA_ROUTES.home}
          className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {backLabel ?? frAdminData.brand.breadcrumb}
        </Link>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-2">
          <h1 className="text-h1 text-text-primary">{title}</h1>
          {subtitle !== undefined ? (
            <p className="text-body-sm text-text-secondary">{subtitle}</p>
          ) : null}
        </div>
        {actions !== undefined ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
