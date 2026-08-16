import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frShowcase } from '@/i18n/profile-showcase';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries, loadOrganizations, loadVisibilityRules } from '@/lib/queries/reference';
import { loadProfileVisibility } from '@/lib/queries/profile-sections';
import { signedAvatarUrl } from '@/lib/queries/member-profile';
import { AppShell } from '@/components/layout/AppShell';
import { AvatarForm } from './AvatarForm';
import { ProfileHeaderForm } from './ProfileHeaderForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.header.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-017 — Modifier l'en-tete et A propos.
 *
 * ECART D-117 LEVE LE 14/08/2026 — le bloc « Identite visuelle » est
 * desormais un VRAI formulaire de depot (`AvatarForm`), avec remplacement
 * et retrait.
 *
 * Ce que disait l'ecart, et pourquoi il tombe : le bucket `avatars`
 * existait depuis 0027, mais aucun ecran de televersement n'etait livre ;
 * afficher un bouton « Changer la photo » sans depot aurait ete un bouton
 * decoratif (MASTER PROMPT §113). Le mecanisme manquant a ete construit
 * depuis, pour le portrait public (0120, `publishPublicPhotoAction`), et il
 * est ici transpose au bucket prive `avatars` : lecture de la signature
 * binaire, borne de 2 Mo (celle du bucket), chemin `<profile_id>/<uuid>`,
 * effacement de l'ancien objet a chaque remplacement. Le motif du refus a
 * disparu ; la decision est donc revisee plutot que reconduite.
 *
 * Deux images, deux choses : celle-ci est PRIVEE (lien signe, membres
 * autorises seulement). Le portrait publie sur le site ouvert reste un
 * objet distinct, avec son consentement propre, sur « Ma vitrine publique ».
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

  // Bucket PRIVE : il n'existe aucune URL publique. Le lien est signe ici,
  // cote serveur, et expire. Un echec de signature retombe sur les initiales.
  const avatarUrl = (await signedAvatarUrl(profile.avatarPath)) ?? null;
  const initials =
    `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || '?';

  return (
    <AppShell currentPath={PROFILE_ROUTES.header} displayName={displayName}>
      <div className="flex flex-col gap-7">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frProfile.header.title}</h1>
          <p className="text-body text-text-secondary">{frProfile.header.subtitle}</p>
        </header>

        <AvatarForm
          // D-209 — meme correctif que PublicPhotoForm : remonte le composant
          // quand le portrait change pour reinitialiser useState(focalX/
          // focalY/zoom) sur les valeurs fraiches du serveur au lieu de
          // conserver le cadrage local de l'ANCIEN avatar applique par
          // erreur au nouveau. Cle sur profile.avatarPath (chemin Storage
          // stable) et non sur avatarUrl : ce dernier est une URL SIGNEE
          // qui change a chaque rendu meme si le fichier n'a pas bouge — la
          // cle aurait sinon force un remontage (et perdu tout reglage non
          // enregistre) a chaque revalidation de la page, pas seulement au
          // remplacement reel de la photo.
          key={profile.avatarPath ?? 'none'}
          avatarUrl={avatarUrl}
          initials={initials}
          focalX={profile.avatarFocalX}
          focalY={profile.avatarFocalY}
          zoom={profile.avatarZoom}
        />

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
