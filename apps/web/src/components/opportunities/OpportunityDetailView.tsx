import { Badge, Card, CardHeader, CardTitle } from '@ise/ui-web';
import { MetaList } from '@ise/ui-web/cards';
import { frOpportunities, to } from '@/i18n/opportunities';
import { formatDate } from '@/lib/network-view';
import { landingMediaUrl } from '@/lib/public/landing-data';
import { StorageImage } from '@/components/media/StorageImage';
import type { OpportunityDetail } from '@/lib/opportunities-view';

/**
 * Corps du détail d'une opportunité (ISE-056), réutilisé tel quel par
 * l'aperçu avant publication (ISE-059).
 *
 * La rémunération n'est rendue que si `compensation_disclosed` est vrai
 * en base : la carte ne reçoit même pas les montants sinon (D27 §32).
 */
export function OpportunityDetailView({ opportunity }: { opportunity: OpportunityDetail }) {
  const required = opportunity.skills.filter((skill) => skill.importance === 'required');
  const preferred = opportunity.skills.filter((skill) => skill.importance === 'preferred');

  return (
    <div className="flex flex-col gap-7">
      <Card>
        {/*
          Visuel de l'offre : EXACTEMENT le media choisi une seule fois dans
          /cms/opportunites (`opportunities.cover_media_id`, D-166), celui-la
          meme qui illustre l'encart de la page d'accueil. Aucun second
          televersement « version mobile » : `next/image` derive les
          resolutions de l'original via `sizes` (meme regle que l'actualite,
          D-172). Sans visuel, rien n'est rendu — pas de cadre vide.
        */}
        {opportunity.cover === null ? null : (
          <div className="bg-surface-muted rounded-base relative mb-5 aspect-[16/9] w-full overflow-hidden">
            <StorageImage
              src={landingMediaUrl(opportunity.cover) ?? ''}
              alt={opportunity.cover.alt}
              sizes="(max-width: 1279px) 100vw, 800px"
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-primary font-semibold uppercase tracking-wide">
            {frOpportunities.type[opportunity.opportunityType] ?? opportunity.opportunityType}
          </span>
          {opportunity.contractType !== null ? (
            <Badge tone="neutral">
              {frOpportunities.contractType[opportunity.contractType] ?? opportunity.contractType}
            </Badge>
          ) : null}
          {opportunity.sourceVerified ? (
            <Badge tone="success">{frOpportunities.list.verifiedBadge}</Badge>
          ) : null}
        </div>

        <h1 className="text-h1 text-text-primary mt-2 font-bold">{opportunity.title}</h1>

        <p className="text-body text-text-secondary mt-2">
          {[
            opportunity.organization,
            [opportunity.city, opportunity.country].filter(Boolean).join(', ') || null,
            opportunity.remoteMode !== null
              ? frOpportunities.remoteMode[opportunity.remoteMode]
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {opportunity.summary !== null ? (
          <p className="text-body-sm text-text-secondary mt-3">{opportunity.summary}</p>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOpportunities.detail.aboutTitle}</CardTitle>
        </CardHeader>
        <p className="text-body text-text-secondary whitespace-pre-line">
          {opportunity.description}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOpportunities.detail.profileTitle}</CardTitle>
        </CardHeader>
        <MetaList
          items={[
            {
              label: frOpportunities.detail.skillsRequired,
              value:
                required.length > 0 ? (
                  <span className="flex flex-wrap justify-end gap-2">
                    {required.map((skill) => (
                      <Badge key={skill.name} tone="info">
                        {skill.name}
                      </Badge>
                    ))}
                  </span>
                ) : null,
            },
            {
              label: frOpportunities.detail.skillsPreferred,
              value:
                preferred.length > 0 ? (
                  <span className="flex flex-wrap justify-end gap-2">
                    {preferred.map((skill) => (
                      <Badge key={skill.name} tone="neutral">
                        {skill.name}
                      </Badge>
                    ))}
                  </span>
                ) : null,
            },
            {
              label: frOpportunities.detail.toolsTitle,
              value:
                opportunity.tools.length > 0
                  ? opportunity.tools.map((tool) => tool.name).join(' · ')
                  : null,
            },
            {
              label: frOpportunities.detail.languagesTitle,
              value:
                opportunity.languages.length > 0
                  ? opportunity.languages.map((language) => language.name).join(' · ')
                  : null,
            },
            {
              label: frOpportunities.detail.countriesTitle,
              value:
                opportunity.countries.length > 0
                  ? opportunity.countries.map((country) => country.name).join(' · ')
                  : null,
            },
            {
              label: frOpportunities.detail.experienceLabel,
              value:
                opportunity.minExperienceYears !== null
                  ? to(frOpportunities.detail.experienceYears, {
                      years: opportunity.minExperienceYears,
                    })
                  : null,
            },
            {
              label: frOpportunities.wizard.levelLabel,
              value:
                opportunity.experienceLevel !== null
                  ? frOpportunities.experienceLevel[opportunity.experienceLevel]
                  : null,
            },
            { label: frOpportunities.wizard.sectorLabel, value: opportunity.sector },
            { label: frOpportunities.wizard.functionLabel, value: opportunity.jobFunction },
          ]}
        />
      </Card>

      {opportunity.questions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frOpportunities.detail.questionsTitle}</CardTitle>
          </CardHeader>
          <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
            {opportunity.questions.map((question) => (
              <li key={question.questionId}>{question.question}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOpportunities.detail.infoTitle}</CardTitle>
        </CardHeader>
        <MetaList
          items={[
            {
              label: frOpportunities.detail.deadlineLabel,
              value:
                opportunity.deadline !== null
                  ? formatDate(opportunity.deadline)
                  : frOpportunities.list.noDeadline,
            },
            {
              label: frOpportunities.detail.startLabel,
              value: opportunity.startDate !== null ? formatDate(opportunity.startDate) : null,
            },
            {
              label: frOpportunities.detail.durationLabel,
              value:
                opportunity.durationDays !== null
                  ? to(frOpportunities.list.durationDays, { count: opportunity.durationDays })
                  : null,
            },
            { label: frOpportunities.detail.positionsLabel, value: opportunity.positionsCount },
            {
              label: frOpportunities.list.compensation,
              value:
                opportunity.compensationMin !== null || opportunity.compensationMax !== null
                  ? `${[opportunity.compensationMin, opportunity.compensationMax]
                      .filter((value): value is number => value !== null)
                      .join(' – ')} ${opportunity.currency ?? ''}`.trim()
                  : frOpportunities.common.notSpecified,
            },
            {
              label: frOpportunities.detail.sourceLabel,
              value: frOpportunities.sourceType[opportunity.sourceType] ?? opportunity.sourceType,
            },
            {
              label: frOpportunities.detail.statusLabel,
              value: frOpportunities.status[opportunity.status] ?? opportunity.status,
            },
            {
              label: frOpportunities.detail.publishedLabel,
              value: opportunity.publishedAt !== null ? formatDate(opportunity.publishedAt) : null,
            },
          ]}
        />
      </Card>
    </div>
  );
}
