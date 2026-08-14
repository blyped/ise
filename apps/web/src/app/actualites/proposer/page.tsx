import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES } from '@/lib/routes/content';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNewsCategoryOptions } from '@/lib/queries/content-proposals';
import { AppShell } from '@/components/layout/AppShell';
import { ACTION_LINK } from '@/components/collab/styles';
import { ProposeNewsForm } from './ProposeNewsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContentProposals.member.newsTitle };

/**
 * Proposer une actualité (0132) — écran MEMBRE.
 *
 * Sous-route d'`/actualites`, comme `/opportunites/publier` l'est
 * d'`/opportunites` : on propose là où l'on lit. Aucune permission
 * particulière n'est requise — `propose_news` exige seulement un membre
 * actif, et c'est la base qui le vérifie.
 */
export default async function ProposeNewsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const [viewer, categories] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNewsCategoryOptions(),
  ]);

  return (
    <AppShell
      currentPath={CONTENT_ROUTES.news}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-caption text-primary font-medium">
            <Link href={CONTENT_ROUTES.news} className="hover:underline">
              {frContentProposals.common.back}
            </Link>
          </p>
          <h1 className="text-h1 text-text-primary font-bold">
            {frContentProposals.member.newsTitle}
          </h1>
          <p className="text-body text-text-secondary max-w-[68ch]">
            {frContentProposals.member.newsSubtitle}
          </p>
          <p>
            <Link href={CONTENT_ROUTES.myProposals} className={`${ACTION_LINK} mt-3`}>
              {frContentProposals.member.myProposalsLink}
            </Link>
          </p>
        </div>

        {/* Une liste de catégories vide n'est pas un formulaire à moitié
            utile : `propose_news` refuserait tout code. On le dit. */}
        {categories.length === 0 ? (
          <EmptyState
            title={frContentProposals.common.loadErrorTitle}
            description={frContentProposals.errors['invalid_category'] ?? ''}
          />
        ) : (
          <ProposeNewsForm categories={categories} />
        )}
      </div>
    </AppShell>
  );
}
