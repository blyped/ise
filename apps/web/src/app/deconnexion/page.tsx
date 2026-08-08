import Link from 'next/link';
import { Card } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { SignOutButton } from '@/components/layout/SignOutButton';
import { BrandLogo } from '@/components/layout/BrandLogo';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.auth.signOut.title };

/**
 * Deconnexion. La fermeture de session est un POST vers une Server Action :
 * un simple GET permettrait de deconnecter un membre a son insu.
 */
export default function SignOutPage() {
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-surface flex h-[var(--layout-topbar)] items-center border-b px-7 max-md:px-5">
        <BrandLogo />
      </header>
      <main
        id="contenu-principal"
        className="mx-auto flex w-full max-w-[520px] flex-col gap-6 px-5 py-14"
      >
        <Card>
          <h1 className="text-h2 text-text-primary font-bold">{fr.auth.signOut.title}</h1>
          <p className="text-body text-text-secondary mt-3">{fr.auth.signOut.body}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SignOutButton variant="primary" />
            <Link
              href={ROUTES.dashboard}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[32px] items-center border border-[#CBD5E1] px-4 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {fr.auth.signOut.stay}
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
