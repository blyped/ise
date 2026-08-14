import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frShowcase } from '@/i18n/profile-showcase';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries, loadOrganizations, loadVisibilityRules } from '@/lib/queries/reference';
import { loadProfileVisibility } from '@/lib/queries/profile-sections';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileHeaderForm } from './ProfileHeaderForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.header.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-017 — Modifier l'en-tete et A propos.
 *
 * ECART ASSUME : le bloc « Identite visuelle » (changer / supprimer la
 * photo) n'est pas rendu comme un bouton. Le bucket `avatars` existe
 * (0027) mais aucun ecran de depot n'est livre : un bouton sans
 * televersement serait decoratif (MASTER PROMPT §113). L'ecran le dit.
 */
export default async function EditProfileHeaderPage() {
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <AppShell currentPath={PROFILE_ROUTES.header} displayName={frProfile.header.title}>
        {context.noProfile ? (
          <Alert
            variant="info"
            title={frProfile.overview.noProfileTitle}
            action={
              <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
                {frProfile.overview.noProfileAction}
              </Link>
            }
          >
            {frProfile.overview.noProfileBody}
          </Alert>
        ) : (
          <ErrorState
            title={frProfile.common.loadErrorTitle}
            description={context.message}
            correlationId={context.correlationId}
          />
        )}
      </AppShell>
    );
  }

  const { profile, correlationId } = context;

  const [countries, organizations, rules, visibility] = await Promise.all([
    loadCountries(correlationId),
    loadOrganizations(correlationId),
    loadVisibilityRules(correlationId),
    loadProfileVisibility(profile.id, correlationId),
  ]);

  const displayName = profile.displayName ?? `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <AppShell currentPath={PROFILE_ROUTES.header} displayName={displayName}>
      <div className="flex flex-col gap-7">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frProfile.header.title}</h1>
          <p className="text-body text-text-secondary">{frProfile.header.subtitle}</p>
        </header>

        <Alert variant="info" title={frProfile.header.photoTitle}>
          {frProfile.header.photoUnavailable}
        </Alert>

        {/* Entrée vers « Ma vitrine publique » : brève description et les deux
            consentements de parution sur le site public (révision D-135,
            migration 0120). Elle vit sur un écran séparé parce qu'elle
            n'engage pas la même chose que les champs ci-dessous : ceux-ci
            s'adressent aux membres connectés, celle-là au web ouvert. */}
        <Alert
          variant="info"
          title={frShowcase.navLabel}
          action={
            <Link href={PROFILE_ROUTES.publicShowcase} className={LINK_CLASS}>
              {frShowcase.navLabel}
            </Link>
          }
        >
          {frShowcase.navHint}
        </Alert>

        {!countries.ok || !organizations.ok || !rules.ok ? (
          <ErrorState
            title={frProfile.common.loadErrorTitle}
            description={frProfile.common.loadErrorBody}
            correlationId={correlationId}
          />
        ) : (
          <ProfileHeaderForm
            profile={profile}
            countries={countries.data}
            organizations={organizations.data}
            rules={rules.data}
            current={visibility.ok ? visibility.data : {}}
          />
        )}
      </div>
    </AppShell>
  );
}
