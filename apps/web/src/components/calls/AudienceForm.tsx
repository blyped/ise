'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Checkbox, ErrorState, Radio, RadioGroup } from '@ise/ui-web';
import { FilterMultiSelect } from '@ise/ui-web/search';
import { frCalls } from '@/i18n/calls';
import { callRoute } from '@/lib/routes/calls';
import { initialFormState } from '@/lib/form-state';
import { VISIBILITY_LEVELS, type CallDetail } from '@/lib/calls-view';
import type { PromotionOption } from '@/lib/queries/reference';
import { saveAudienceAction } from '@/app/appels/actions';

/**
 * ISE-051 — étape 3 : ciblage d'audience.
 *
 * ECART ASSUME : la maquette propose une option « Membres sélectionnés »
 * avec un sélecteur nominatif, ainsi que des canaux de notification.
 * Ni l'un ni l'autre ne sont rendus. Le ciblage nominatif exigerait un
 * sélecteur de membres respectant la visibilité de chacun — la base le
 * supporte (`network_call_audience_profiles`), l'écran viendra avec lui.
 * Les canaux de notification n'existent pas : aucun consommateur
 * d'événement n'est déployé, et un interrupteur sans effet est un bouton
 * décoratif (MASTER PROMPT §113).
 */
export function AudienceForm({
  call,
  promotions,
}: {
  call: CallDetail;
  promotions: readonly PromotionOption[];
}) {
  const [state, formAction, isPending] = useActionState(saveAudienceAction, initialFormState);
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="callId" value={call.callId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <RadioGroup legend={frCalls.wizard.visibilityLegend}>
        {VISIBILITY_LEVELS.map((level) => (
          <Radio
            key={level}
            name="visibility"
            value={level}
            defaultChecked={call.visibility === level}
            label={frCalls.visibility[level] ?? level}
            description={frCalls.visibilityHint[level] ?? ''}
          />
        ))}
      </RadioGroup>

      <FilterMultiSelect
        name="audiencePromotionIds"
        legend={frCalls.wizard.audiencePromotionsLabel}
        hint={frCalls.wizard.audiencePromotionsHint}
        options={promotions.map((promotion) => ({
          value: String(promotion.id),
          label: `${promotion.programCode} ${promotion.graduationYear}`,
        }))}
        selected={selectedPromotions}
        onChange={setSelectedPromotions}
        searchPlaceholder="Rechercher une promotion…"
        noMatchLabel="Aucune promotion ne correspond."
        showingTemplate="{shown} promotions sur {total}"
        selectedLegend="Promotions ciblées"
        removeLabel="Retirer"
      />

      <Checkbox
        name="hideOrganization"
        defaultChecked={false}
        label={frCalls.wizard.hideOrganizationLabel}
      />

      <Alert variant="warning" title={frCalls.wizard.overreachTitle}>
        {frCalls.wizard.overreachBody}
      </Alert>

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`${callRoute(call.callId)}/profil-recherche`}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frCalls.common.back}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frCalls.common.savePending}>
          {frCalls.common.save}
        </Button>
      </div>
    </form>
  );
}
