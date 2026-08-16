import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries, loadOrganizations, loadVisibilityRules } from '@/lib/queries/reference';
import { loadProfileVisibility } from '@/lib/queries/profile-sections';
import { signedAvatarUrl } from '@/lib/queries/member-profile';
import { loadPublicShowcase } from '@/lib/queries/public-showcase';
import { LANDING_MEDIA_BUCKET, landingMediaUrl } from '@/lib/public/landing-data';
import { frShowcase } from '@/i18n/profile-showcase';
import { AppShell } from '@/components/layout/AppShell';
import { PhotoForm } from './PhotoForm';
import { ProfileHeaderForm } from './ProfileHeaderForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.header.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-017 — Modifier l'en-tete et A propos.
 *
 * FUSION D-211 (16/08/2026) — le depot de photo et le consentement de
 * publication (« Ma vitrine publique ») convergent ici en UN SEUL geste.
 * Demande du porteur, verbatim : « je ne veux meme pas qu'on mette 2 photos
 * pour chaque profil. la photo que l'ISE mettra pour son profil, c'est elle
 * qui sera affiche devant pour l'accueil. » -- et : « tu mets deux blocs de
 * cadrages (pour la photo de profil et pour celle de l'accueil). comme ca,
 * il voit exactement comment ca sera sur le deux pages. et il enregistre.
 * s'il enregistre c'est bon pour les deux. »
 *
 * Cette page charge donc DEUX sources qui vivaient avant sur deux ecrans
 * distincts : le profil (avatar prive, `signedAvatarUrl`) ET la vitrine
 * publique (`loadPublicShowcase`, pour `allowPublicPhoto` et le cadrage
 * rectangle deja enregistre). `PhotoForm` les recoit toutes deux et affiche
 * les deux apercus de cadrage cote a cote.
 *
 * ECART D-117 LEVE LE 14/08/2026 (rappel, toujours vrai) — le bloc photo
 * est un vrai formulaire de depot, avec remplacement et retrait ; voir
 * `actions.ts` pour le detail du mecanisme (bucket prive `avatars`, copie
 * consentie vers le bucket public `landing-media`, jamais l'inverse).
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

  const [countries, organizations, rules, visibility, showcase] = await Promise.all([
    loadCountries(correlationId),
    loadOrganizations(correlationId),
    loadVisibilityRules(correlationId),
    loadProfileVisibility(profile.id, correlationId),
    loadPublicShowcase(profile.id, correlationId),
  ]);

  const displayName = profile.displayName ?? `${profile.firstName} ${profile.lastName}`.trim();

  // Bucket PRIVE : il n'existe aucune URL publique. Le lien est signe ici,
  // cote serveur, et expire. Un echec de signature retombe sur les initiales.
  const avatarUrl = (await signedAvatarUrl(profile.avatarPath)) ?? null;
  const initials =
    `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || '?';

  // Copie publique deja deposee : meme regle de construction d'URL que
  // l'ancienne vitrine publique (D-135/0120) — seulement si consentement ET
  // chemin presents, jamais l'un sans l'autre.
  const publicPhotoUrl =
    showcase.ok && showcase.data.allowPublicPhoto && showcase.data.photoPath !== null
      ? landingMediaUrl({
          bucket: LANDING_MEDIA_BUCKET,
          path: showcase.data.photoPath,
          alt: showcase.data.photoAlt ?? '',
          credit: null,
          width: showcase.data.photoWidth,
          height: showcase.data.photoHeight,
          focalX: null,
          focalY: null,
          zoom: null,
        })
      : null;

  return (
    <AppShell currentPath={PROFILE_ROUTES.header} displayName={displayName}>
      <div className="flex flex-col gap-7">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frProfile.header.title}</h1>
          <p className="text-body text-text-secondary">{frProfile.header.subtitle}</p>
        </header>

        <PhotoForm
          // D-209 — remonte le composant quand la photo change (depot ou
          // retrait) pour reinitialiser tout l'etat local de cadrage sur
          // les valeurs fraiches du serveur, plutot que de garder le
          // reglage de l'ANCIENNE photo applique par erreur a la nouvelle.
          // Cle sur avatarPath (chemin Storage stable), pas sur avatarUrl
          // (URL signee, change a chaque rendu meme sans remplacement).
          key={profile.avatarPath ?? 'none'}
          avatarUrl={avatarUrl}
          initials={initials}
          avatarFocalX={profile.avatarFocalX}
          avatarFocalY={profile.avatarFocalY}
          avatarZoom={profile.avatarZoom}
          allowPublicPhoto={showcase.ok ? showcase.data.allowPublicPhoto : false}
          publicPhotoUrl={publicPhotoUrl}
          publicPhotoAlt={showcase.ok ? showcase.data.photoAlt : null}
          photoFocalX={showcase.ok ? showcase.data.photoFocalX : 50}
          photoFocalY={showcase.ok ? showcase.data.photoFocalY : 50}
          photoZoom={showcase.ok ? showcase.data.photoZoom : 1}
        />

        {/* Entree vers « Ma vitrine publique » : la breve description et le
            consentement a paraitre comme « ISE du jour » (texte) restent un
            geste distinct du depot de photo (revision D-211, 16/08/2026) —
            ce sont deux objets qui n'ont jamais ete confondus depuis D-135. */}
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
