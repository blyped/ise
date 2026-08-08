import { Badge, Card, CardHeader, CardTitle } from '@ise/ui-web';
import { MetaList } from '@ise/ui-web/cards';
import { frCalls, tc } from '@/i18n/calls';
import { formatDate } from '@/lib/network-view';
import type { CallDetail } from '@/lib/calls-view';

/**
 * Corps du détail d'un appel (ISE-048), réutilisé tel quel par l'aperçu
 * avant publication (ISE-052).
 *
 * Réutiliser le MÊME composant est la seule façon honnête de tenir la
 * promesse « voici exactement ce que verront les membres » (D6 §42) :
 * une reproduction approximative aurait divergé dès la première
 * modification.
 */
export function CallDetailView({ call }: { call: CallDetail }) {
  const experience =
    call.minExperienceYears !== null && call.maxExperienceYears !== null
      ? tc(frCalls.detail.experienceRange, {
          min: call.minExperienceYears,
          max: call.maxExperienceYears,
        })
      : call.minExperienceYears !== null
        ? tc(frCalls.detail.experienceMin, { years: call.minExperienceYears })
        : null;

  return (
    <div className="flex flex-col gap-7">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {call.urgency === 'deadline_soon' && call.status === 'active' ? (
            <Badge tone="accent">{frCalls.list.urgentBadge}</Badge>
          ) : null}
          <span className="text-caption text-primary font-semibold uppercase tracking-wide">
            {frCalls.type[call.callType] ?? call.callType}
          </span>
        </div>

        <h1 className="text-h1 text-text-primary mt-2 font-bold">{call.title}</h1>

        {call.author !== null ? (
          <p className="text-body-sm text-text-secondary mt-4">
            <span className="text-text-primary font-semibold">{call.author.displayName}</span>
            {call.author.promotionLabel ? ` · ${call.author.promotionLabel}` : ''}
            {call.author.currentOrganization ? ` · ${call.author.currentOrganization}` : ''}
            {call.publishedAt !== null
              ? ` · ${tc(frCalls.list.publishedOn, { date: formatDate(call.publishedAt) })}`
              : ''}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCalls.detail.needTitle}</CardTitle>
        </CardHeader>
        <p className="text-body text-text-secondary whitespace-pre-line">{call.description}</p>

        {call.helpTypes.length > 0 ? (
          <div className="border-border mt-6 border-t pt-5">
            <h3 className="text-body-sm text-text-primary font-semibold">
              {frCalls.detail.helpTypesTitle}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {call.helpTypes.map((helpType) => (
                <li key={helpType}>
                  <Badge tone="info">{frCalls.helpType[helpType] ?? helpType}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {call.context !== null ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCalls.detail.contextTitle}</CardTitle>
          </CardHeader>
          <p className="text-body text-text-secondary whitespace-pre-line">{call.context}</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCalls.detail.wantedProfileTitle}</CardTitle>
        </CardHeader>

        {call.wantedProfile !== null ? (
          <p className="text-body text-text-secondary mb-5 whitespace-pre-line">
            {call.wantedProfile}
          </p>
        ) : null}

        <MetaList
          items={[
            {
              label: frCalls.detail.skillsLabel,
              value:
                call.skills.length > 0 ? (
                  <span className="flex flex-wrap justify-end gap-2">
                    {call.skills.map((skill) => (
                      <Badge
                        key={skill.name}
                        tone={skill.importance === 'required' ? 'info' : 'neutral'}
                      >
                        {skill.name}
                        {skill.importance === 'required' ? ` · ${frCalls.common.required}` : ''}
                      </Badge>
                    ))}
                  </span>
                ) : null,
            },
            {
              label: frCalls.detail.toolsLabel,
              value: call.tools.length > 0 ? call.tools.map((tool) => tool.name).join(' · ') : null,
            },
            {
              label: frCalls.detail.languagesLabel,
              value:
                call.languages.length > 0
                  ? call.languages.map((language) => language.name).join(' · ')
                  : null,
            },
            { label: frCalls.detail.sectorLabel, value: call.sector },
            {
              label: frCalls.detail.countriesLabel,
              value:
                call.countries.length > 0
                  ? call.countries.map((country) => country.name).join(' · ')
                  : [call.city, call.country].filter(Boolean).join(', ') || null,
            },
            { label: frCalls.detail.experienceLabel, value: experience },
            {
              label: 'Promotions',
              value:
                call.promotionYearFrom !== null && call.promotionYearTo !== null
                  ? tc(frCalls.detail.promotionRange, {
                      from: call.promotionYearFrom,
                      to: call.promotionYearTo,
                    })
                  : null,
            },
          ]}
        />
      </Card>
    </div>
  );
}
