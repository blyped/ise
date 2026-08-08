import { fr } from '@/i18n/fr';

/** ADDENDUM §7 — Pied de page public. */
export function PublicFooter() {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="border-border bg-surface border-t">
      <div className="mx-auto flex w-full max-w-[var(--layout-content-max)] flex-wrap items-center justify-between gap-5 px-7 py-8 max-md:flex-col max-md:items-start max-md:px-5">
        <p className="text-caption text-text-muted">
          © {year} {fr.public.footer.rights}
        </p>
        <nav aria-label={fr.public.footer.label}>
          <ul className="text-caption text-text-secondary flex flex-wrap items-center gap-5">
            <li>{fr.footer.privacy}</li>
            <li aria-hidden="true" className="text-text-muted">
              ·
            </li>
            <li>{fr.footer.terms}</li>
            <li aria-hidden="true" className="text-text-muted">
              ·
            </li>
            <li>{fr.public.footer.contact}</li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
