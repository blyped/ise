import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { frNetwork } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { NETWORK_ROUTES, connectRoute, introductionPathRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import {
  isUuid,
  loadMemberProfile,
  signedAvatarUrl,
  type MemberProfileView,
} from '@/lib/queries/member-profile';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Champs que l'ecran sait afficher : sert a detecter ce qui a ete restreint. */
const EXPECTED_FIELDS = [
  'headline',
  'bio',
  'current_position',
  'current_organization',
  'country',
  'city',
  'promotion',
  'skills',
  'sectors',
  'languages',
  'experiences',
  'availabilities',
] as const;

function formatPeriod(start: string | null, end: string | null, current: boolean): string {
  const year = (value: string | null) => (value ? value.slice(0, 4) : '');
  const from = year(start);
  const to = current ? frSearch.profile.experienceCurrent : year(end);
  if (from === '' && to === '') return '';
  return frSearch.profile.experiencePeriod.replace('{start}', from).replace('{end}', to);
}

function KeyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0 md:flex-row md:justify-between md:gap-6">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-body-sm text-text-primary md:max-w-[62%] md:text-right">{value}</dd>
    </div>
  );
}

function SkillRow({ name, level, years }: { name: string; level: string; years: number | null }) {
  return (
    <li className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <span className="text-body-sm text-text-primary font-medium">{name}</span>
      <span className="flex items-center gap-3">
        <Badge tone="neutral">{level}</Badge>
        {years !== null ? (
          <span className="text-caption text-text-muted">
            {frSearch.profile.skillYears.replace('{years}', String(years))}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * ISE-037 — Profil d'un autre ISE.
 *
 * VISIBILITE PAR CHAMP : la page n'interroge PAS `ise_profiles` ni ses
 * tables satellites. Elle appelle `public.get_member_profile()` qui
 * compose le profil en base, champ par champ, selon la visibilite
 * effective du proprietaire. Un champ non autorise n'arrive donc jamais
 * jusqu'ici : il n'est pas masque, il n'existe pas dans la reponse
 * (MASTER PROMPT §47).
 *
 * BLOCAGE : `can_see_profile()` evalue le blocage AVANT toute visibilite,
 * dans les deux sens. Un profil bloque fait renvoyer `null`, donc un 404
 * — indistinguable d'un profil inexistant, ce qui est voulu : la reponse
 * ne doit pas reveler qu'un blocage existe.
 *
 * ACTIONS : ISE-038 (« Se connecter ») et ISE-044 (« Demander une
 * introduction ») ne sont pas livres. Aucun bouton n'est rendu — un
 * bouton qui n'aboutit nulle part est un bouton decoratif
 * (MASTER PROMPT §113). L'ecran explique ce qui manque, sans le simuler.
 */
export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { profileId } = await params;
  if (!isUuid(profileId)) notFound();

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMemberProfile(profileId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={SEARCH_ROUTES.results}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok) {
    return shell(
      <ErrorState
        title={frSearch.results.errorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={SEARCH_ROUTES.find} className={ACTION_LINK}>
            {frSearch.profile.notFoundAction}
          </Link>
        }
      />,
    );
  }

  if (result.data === null) {
    return shell(
      <div className="flex flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frSearch.profile.notFoundTitle}</h1>
        <p className="text-body text-text-secondary">{frSearch.profile.notFoundBody}</p>
        <p>
          <Link href={SEARCH_ROUTES.find} className={ACTION_LINK}>
            {frSearch.profile.notFoundAction}
          </Link>
        </p>
      </div>,
    );
  }

  const profile: MemberProfileView = result.data;
  const avatarUrl = await signedAvatarUrl(profile.avatarPath);

  const visible = new Set(profile.visibleFields);
  const restricted = EXPECTED_FIELDS.filter((field) => !visible.has(field));

  const location = [profile.currentCity, profile.currentCountry]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');

  const identityLine = [profile.promotion?.label ?? null, location]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' · ');

  const relation = profile.relationship;
  const relationItems: string[] = [];
  if (profile.isSelf) relationItems.push(frSearch.profile.relationSelf);
  if (relation.isConnected) relationItems.push(frSearch.profile.relationConnected);
  if (relation.sharesPromotion && profile.promotion !== null) {
    relationItems.push(
      frSearch.profile.relationPromotion.replace('{promotion}', profile.promotion.label),
    );
  }
  if (relation.sharesOrganization && relation.sharedOrganizationName !== null) {
    relationItems.push(
      frSearch.profile.relationOrganization.replace(
        '{organization}',
        relation.sharedOrganizationName,
      ),
    );
  }
  if (relation.mutualConnectionCount > 0) {
    relationItems.push(
      relation.mutualConnectionCount === 1
        ? frSearch.profile.relationMutualOne
        : frSearch.profile.relationMutualMany.replace(
            '{count}',
            String(relation.mutualConnectionCount),
          ),
    );
  }

  const keyFacts: { label: string; value: string }[] = [];
  if (profile.currentPosition)
    keyFacts.push({ label: frSearch.profile.keyFactPosition, value: profile.currentPosition });
  if (profile.currentOrganization)
    keyFacts.push({
      label: frSearch.profile.keyFactOrganization,
      value: profile.currentOrganization,
    });
  if (location.length > 0)
    keyFacts.push({ label: frSearch.profile.keyFactLocation, value: location });
  if (profile.sectors.length > 0)
    keyFacts.push({
      label: frSearch.profile.keyFactSectors,
      value: profile.sectors.map((item) => item.name).join(' · '),
    });
  if (profile.jobFunctions.length > 0)
    keyFacts.push({
      label: frSearch.profile.keyFactFunctions,
      value: profile.jobFunctions.map((item) => item.name).join(' · '),
    });
  if (profile.expertiseAreas.length > 0)
    keyFacts.push({
      label: frSearch.profile.keyFactExpertise,
      value: profile.expertiseAreas.map((item) => item.name).join(' · '),
    });
  if (profile.experienceCountries.length > 0)
    keyFacts.push({
      label: frSearch.profile.keyFactExperienceCountries,
      value: profile.experienceCountries.map((item) => item.name).join(' · '),
    });
  if (profile.languages.length > 0)
    keyFacts.push({
      label: frSearch.profile.keyFactLanguages,
      value: profile.languages.map((item) => item.name).join(' · '),
    });
  if (profile.tools.length > 0)
    keyFacts.push({
      label: frSearch.profile.keyFactTools,
      value: profile.tools.map((item) => item.name).join(' · '),
    });

  return shell(
    <div className="flex flex-col gap-8">
      <p>
        <Link
          href={SEARCH_ROUTES.find}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {frSearch.profile.backToResults}
        </Link>
      </p>

      {/* ---- En-tete ----
          375 px : avatar centre au-dessus du nom, ligne d'identite en pile.
          1024 px et plus : avatar a gauche, identite a droite, sur une
          bande sombre pleine largeur (MASTER PROMPT §57). */}
      <header className="bg-deep-navy rounded-lg px-7 py-8 text-white max-md:px-5">
        <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-start lg:gap-7 lg:text-left">
          <Avatar name={profile.displayName} src={avatarUrl} size={96} decorative />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <h1 className="text-h1 font-bold">{profile.displayName}</h1>
              {profile.verificationStatus === 'verified' ? (
                <Badge tone="success">{frSearch.profile.verified}</Badge>
              ) : null}
            </div>

            {identityLine.length > 0 ? (
              <p className="text-body-sm mt-2 text-[#CBD5E1]">{identityLine}</p>
            ) : null}

            {profile.headline !== null ? (
              <p className="text-body mt-3 font-medium">{profile.headline}</p>
            ) : null}

            {profile.currentOrganization !== null ? (
              <p className="text-body-sm mt-1 text-[#CBD5E1]">{profile.currentOrganization}</p>
            ) : null}
          </div>
        </div>
      </header>

      {profile.claimStatus !== 'claimed' ? (
        <Alert variant="info" title={frSearch.profile.referenced}>
          {frSearch.profile.referencedHint}
        </Alert>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        {/* ---- Colonne principale ---- */}
        <div className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frSearch.profile.aboutTitle}</CardTitle>
            </CardHeader>
            {profile.bio !== null ? (
              <p className="text-body text-text-secondary whitespace-pre-line">{profile.bio}</p>
            ) : (
              <p className="text-body-sm text-text-muted">{frSearch.profile.aboutEmpty}</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frSearch.profile.skillsTitle}</CardTitle>
            </CardHeader>
            {profile.skills.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frSearch.profile.skillsEmpty}</p>
            ) : (
              <>
                {/* D-75 : le niveau est DECLARATIF, et l'ecran le dit. */}
                <p className="text-caption text-text-muted mb-3">
                  {frSearch.profile.skillsDeclarative}
                </p>
                <ul className="flex flex-col">
                  {profile.skills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      name={skill.name}
                      level={
                        skill.level === null
                          ? frSearch.profile.skillLevel.undeclared
                          : frSearch.profile.skillLevel[skill.level]
                      }
                      years={skill.yearsExperience}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frSearch.profile.experiencesTitle}</CardTitle>
            </CardHeader>
            {profile.experiences.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frSearch.profile.experiencesEmpty}</p>
            ) : (
              <ol className="flex flex-col gap-5">
                {profile.experiences.map((experience) => (
                  <li
                    key={experience.id}
                    className="border-border border-b pb-5 last:border-b-0 last:pb-0"
                  >
                    <p className="text-body text-text-primary font-semibold">
                      {experience.positionTitle}
                    </p>
                    {experience.organization !== null ? (
                      <p className="text-body-sm text-text-secondary mt-1">
                        {experience.organization}
                      </p>
                    ) : null}
                    <p className="text-caption text-text-muted mt-1">
                      {[
                        formatPeriod(
                          experience.startDate,
                          experience.endDate,
                          experience.isCurrent,
                        ),
                        [experience.city, experience.country]
                          .filter((part): part is string => Boolean(part))
                          .join(', '),
                        experience.sector,
                      ]
                        .filter((part) => typeof part === 'string' && part.length > 0)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {profile.educations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.profile.educationsTitle}</CardTitle>
              </CardHeader>
              <ol className="flex flex-col gap-4">
                {profile.educations.map((education) => (
                  <li key={education.id}>
                    <p className="text-body-sm text-text-primary font-semibold">
                      {education.degree ?? education.institution}
                    </p>
                    <p className="text-caption text-text-muted">
                      {[
                        education.degree !== null ? education.institution : null,
                        education.fieldOfStudy,
                        education.endYear !== null ? String(education.endYear) : null,
                      ]
                        .filter((part): part is string => Boolean(part))
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        {/* ---- Colonne laterale ----
            375 px : « Ce qui vous relie » et « Disponible pour aider »
            remontent AVANT le parcours (c'est ce qui declenche une prise
            de contact) ; les informations cles descendent en fin de page.
            1440 px : la colonne reste visible pendant la lecture. */}
        <aside className="flex flex-col gap-7 max-xl:order-first">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frSearch.profile.relationTitle}</CardTitle>
            </CardHeader>
            {relationItems.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frSearch.profile.relationNone}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {relationItems.map((item) => (
                  <li key={item} className="text-body-sm text-text-secondary">
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption text-text-muted mt-4">{frSearch.profile.relationSource}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frSearch.profile.availabilityTitle}</CardTitle>
            </CardHeader>
            {profile.availabilities.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frSearch.profile.availabilityEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {profile.availabilities.map((availability) => (
                  <li key={availability.code}>
                    <p className="text-body-sm text-text-primary font-medium">
                      {availability.name}
                    </p>
                    {availability.description !== null ? (
                      <p className="text-caption text-text-muted">{availability.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/*
            ISE-038 et ISE-043 sont livres : les deux actions mènent
            desormais quelque part. « Se connecter » disparait lorsque la
            relation existe deja, « Demander une introduction » aussi —
            un bouton qui echouerait a coup sur serait decoratif
            (MASTER PROMPT §113).
          */}
          {!profile.isSelf ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.profile.actionsTitle}</CardTitle>
              </CardHeader>
              {relation.isConnected ? (
                <div className="flex flex-col gap-4">
                  <p className="text-body-sm text-text-secondary">
                    {frNetwork.connect.alreadyConnectedTitle}
                  </p>
                  <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
                    {frNetwork.connections.title}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link
                    href={connectRoute(profile.profileId)}
                    className="rounded-base bg-primary text-body hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[48px] items-center justify-center px-7 font-semibold text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {frNetwork.connect.title}
                  </Link>
                  <Link href={introductionPathRoute(profile.profileId)} className={ACTION_LINK}>
                    {frNetwork.connect.introductionAction}
                  </Link>
                  <p className="text-caption text-text-muted">
                    {frNetwork.connect.introductionBody}
                  </p>
                </div>
              )}
            </Card>
          ) : null}

          {keyFacts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.profile.keyFactsTitle}</CardTitle>
              </CardHeader>
              <dl className="flex flex-col gap-3">
                {keyFacts.map((fact) => (
                  <KeyFact key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </dl>

              {profile.linkedinUrl !== null || profile.websiteUrl !== null ? (
                <div className="border-border mt-5 flex flex-col gap-2 border-t pt-4">
                  {profile.linkedinUrl !== null ? (
                    <a
                      href={profile.linkedinUrl}
                      rel="noreferrer noopener nofollow"
                      target="_blank"
                      className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue inline-flex min-h-[44px] items-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {frSearch.profile.keyFactLinkedin}
                    </a>
                  ) : null}
                  {profile.websiteUrl !== null ? (
                    <a
                      href={profile.websiteUrl}
                      rel="noreferrer noopener nofollow"
                      target="_blank"
                      className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue inline-flex min-h-[44px] items-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {frSearch.profile.keyFactWebsite}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : (
            <EmptyState
              title={frSearch.profile.keyFactsTitle}
              description={frSearch.common.notAuthorized}
            />
          )}

          {profile.promotion !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.profile.promotionTitle}</CardTitle>
              </CardHeader>
              <p className="text-h4 text-text-primary font-semibold">{profile.promotion.name}</p>
              <p className="text-body-sm text-text-secondary mt-1">{profile.promotion.label}</p>
            </Card>
          ) : null}

          {/*
            Transparence : on indique qu'une partie du profil est restreinte,
            sans dire laquelle en detail — et surtout sans l'avoir recue.
          */}
          {restricted.length > 0 ? (
            <Alert variant="info" title={frSearch.profile.hiddenFieldsTitle}>
              {frSearch.profile.hiddenFieldsBody}
            </Alert>
          ) : null}
        </aside>
      </div>
    </div>,
  );
}
