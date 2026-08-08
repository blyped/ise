import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, ErrorState } from '@ise/ui-web';
import { fr, t } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClaimableProfile, type ClaimableProfileDetail } from '@/lib/queries/claim';
import { AuthCard } from '@/components/layout/AuthCard';
import { AuthShell } from '@/components/layout/AuthShell';
import { ClaimConfirmForm } from './ClaimConfirmForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.claim.confirm.title };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LINK_CLASS =
  'font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Une ligne « libelle / valeur » des elements de correspondance. */
function MatchRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-base border-border bg-surface flex flex-wrap items-baseline justify-between gap-3 border px-5 py-4">
      <div className="min-w-0">
        <p className="text-caption text-text-muted">{label}</p>
        <p className="text-body-sm text-text-primary mt-1 font-semibold">
          {value ?? fr.claim.confirm.notProvided}
        </p>
      </div>
    </div>
  );
}

function ProfileSummary({ profile }: { profile: ClaimableProfileDetail }) {
  const promotion =
    profile.graduationYear === null
      ? fr.claim.search.promotionUnknown
      : (profile.promotionName ??
        t(fr.claim.search.promotionLabel, { year: profile.graduationYear }));

  const location = [profile.currentCity, profile.currentCountry].filter(Boolean).join(' · ');

  return (
    <Card className="bg-[#EFF6FF]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-h4 text-text-primary font-semibold">{profile.displayName}</p>
          <p className="text-body-sm text-primary mt-1 font-semibold">
            {promotion}
            {location ? ` · ${location}` : ''}
          </p>
          {profile.headline ? (
            <p className="text-body-sm text-text-secondary mt-2">{profile.headline}</p>
          ) : null}
        </div>
        <Badge tone="success">{fr.claim.confirm.referencedBadge}</Badge>
      </div>
    </Card>
  );
}

/**
 * ISE-006 — Confirmer l'association du profil.
 *
 * Le recapitulatif vient de `public.get_claimable_profile` : depuis 0028,
 * `authenticated` n'a plus de privilege `SELECT` au niveau table sur
 * `ise_profiles`, et un compte sans profil ne verrait de toute facon aucune
 * ligne. Aucun `select('*')`, aucun persona en dur : si la fonction ne
 * renvoie rien, l'ecran le dit.
 */
export default async function ClaimConfirmPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();

  const shell = (children: React.ReactNode) => (
    <AuthShell
      panelTitle={fr.claim.confirm.panelTitle}
      panelBody={fr.claim.confirm.panelBody}
      panelPillars={fr.claim.confirm.panelPillars}
      contentWidth="wide"
    >
      {children}
    </AuthShell>
  );

  const unavailable = shell(
    <AuthCard title={fr.claim.confirm.title}>
      <Alert variant="warning" title={fr.claim.confirm.unavailableTitle}>
        {fr.claim.confirm.unavailableBody}
      </Alert>
      <p className="text-body-sm text-text-secondary">
        <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
          {fr.claim.confirm.backToResults}
        </Link>
      </p>
    </AuthCard>,
  );

  if (!UUID_RE.test(profileId)) return unavailable;

  const result = await getClaimableProfile(profileId, correlationId);

  if (!result.ok) {
    return shell(
      <AuthCard title={fr.claim.confirm.title}>
        <ErrorState
          title={result.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
              {fr.claim.confirm.backToResults}
            </Link>
          }
        />
      </AuthCard>,
    );
  }

  const profile = result.data;
  if (profile === null) return unavailable;

  return shell(
    <AuthCard title={fr.claim.confirm.title} subtitle={fr.claim.confirm.subtitle}>
      <ProfileSummary profile={profile} />

      <section className="flex flex-col gap-3" aria-labelledby="elements-correspondance">
        <h2 id="elements-correspondance" className="text-body-sm text-text-primary font-semibold">
          {fr.claim.confirm.matchTitle}
        </h2>
        <MatchRow
          label={fr.claim.confirm.promotionLabel}
          value={
            profile.graduationYear === null
              ? null
              : t(fr.claim.search.promotionLabel, { year: profile.graduationYear })
          }
        />
        <MatchRow label={fr.claim.confirm.cityLabel} value={profile.currentCity} />
        <MatchRow label={fr.claim.confirm.organizationLabel} value={profile.currentOrganization} />
        <MatchRow label={fr.claim.confirm.positionLabel} value={profile.currentPosition} />
        {/*
          L'indice d'e-mail est construit en base (`a•••@d•••.com`) : l'adresse
          complete ne quitte jamais le serveur (MASTER PROMPT §47).
        */}
        <MatchRow label={fr.claim.confirm.emailLabel} value={profile.emailHint} />
      </section>

      <ClaimConfirmForm
        profileId={profile.profileId}
        hasHistoricalEmail={profile.hasHistoricalEmail}
      />
    </AuthCard>,
  );
}
