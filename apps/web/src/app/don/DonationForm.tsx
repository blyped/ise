'use client';

import { useActionState, useMemo, useState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frDonations, tdon } from '@/i18n/donations';
import { initialFormState } from '@/lib/form-state';
import {
  amountMatchesRule,
  formatDonationAmount,
  parseAmountToMinor,
  type DonationCurrencyRule,
  type DonationProvider,
} from '@/lib/donations/shared';
import { startDonationAction } from '@/app/don/actions';

/**
 * Formulaire de don.
 *
 * CE COMPOSANT NE TOUCHE JAMAIS A UNE CARTE BANCAIRE. Il ne collecte qu'un
 * montant, une voie de paiement et deux options. La saisie des coordonnees
 * bancaires a lieu chez le prestataire, sur sa propre page.
 *
 * LE CONTROLE DE MONTANT FAIT ICI EST UN CONFORT, PAS UNE SECURITE : il
 * evite un aller-retour inutile. La verite est en base —
 * `public.start_donation()` revalide bornes, pas et devise, et refuse la
 * creation sinon. Un montant force dans le champ cache ne produira donc
 * rien d'autre qu'un message d'erreur.
 *
 * Les regles affichees (montants proposes, bornes, pas) viennent de la base,
 * pas d'une liste ecrite en dur : l'ecran montre exactement ce que le
 * serveur accepte.
 */
export function DonationForm({ rules }: { rules: readonly DonationCurrencyRule[] }) {
  const [state, formAction, isPending] = useActionState(startDonationAction, initialFormState);

  const firstRule = rules[0];
  const [provider, setProvider] = useState<DonationProvider>(firstRule?.provider ?? 'cinetpay');
  const [presetAmount, setPresetAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const rule = useMemo(
    () => rules.find((candidate) => candidate.provider === provider) ?? firstRule,
    [rules, provider, firstRule],
  );

  const amountMinor = useMemo(() => {
    if (rule === undefined) return null;
    if (customAmount.trim().length > 0) {
      return parseAmountToMinor(customAmount, rule.minorUnitExponent);
    }
    return presetAmount;
  }, [rule, customAmount, presetAmount]);

  const amountIsValid =
    rule !== undefined && amountMinor !== null && amountMatchesRule(amountMinor, rule);

  if (rule === undefined) return null;

  const providerLabel = (value: DonationProvider): string =>
    value === 'stripe' ? frDonations.form.stripeLabel : frDonations.form.cinetpayLabel;
  const providerDescription = (value: DonationProvider): string =>
    value === 'stripe' ? frDonations.form.stripeDescription : frDonations.form.cinetpayDescription;

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="amountMinor" value={amountMinor === null ? '' : amountMinor} />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? frDonations.form.submitPending : (state.message ?? '')}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frDonations.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      {/* Voie de paiement ------------------------------------------------ */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-body-sm text-text-primary font-medium">
          {frDonations.form.providerLegend}
        </legend>
        <p className="text-caption text-text-muted">{frDonations.form.providerHint}</p>
        <div className="flex flex-col gap-3">
          {rules.map((candidate) => (
            <label
              key={candidate.provider}
              className="rounded-base border-border bg-surface hover:border-primary flex cursor-pointer items-start gap-3 border p-4"
            >
              <input
                type="radio"
                name="providerChoice"
                value={candidate.provider}
                checked={provider === candidate.provider}
                onChange={() => {
                  setProvider(candidate.provider);
                  setPresetAmount(null);
                  setCustomAmount('');
                }}
                className="mt-1"
              />
              <span className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {providerLabel(candidate.provider)}
                </span>
                <span className="text-caption text-text-secondary">
                  {providerDescription(candidate.provider)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Montant ---------------------------------------------------------- */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-body-sm text-text-primary font-medium">
          {frDonations.form.amountLegend}
        </legend>
        <p className="text-caption text-text-muted">{frDonations.form.amountHint}</p>

        <div className="flex flex-wrap gap-2">
          {rule.presetAmounts.map((preset) => {
            const selected = customAmount.trim().length === 0 && presetAmount === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setPresetAmount(preset);
                  setCustomAmount('');
                }}
                aria-pressed={selected}
                className={
                  selected
                    ? 'rounded-base border-primary bg-[#EFF6FF] text-primary-hover min-h-[44px] border px-5 text-body-sm font-semibold'
                    : 'rounded-base border-border bg-surface text-text-primary hover:border-primary min-h-[44px] border px-5 text-body-sm'
                }
              >
                {formatDonationAmount(preset, rule.currency, rule.minorUnitExponent)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="don-montant-libre" className="text-body-sm text-text-primary font-medium">
            {frDonations.form.customAmountLabel}
          </label>
          <input
            id="don-montant-libre"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={customAmount}
            onChange={(event) => {
              setCustomAmount(event.target.value);
              setPresetAmount(null);
            }}
            placeholder={frDonations.form.customAmountPlaceholder}
            aria-describedby="don-montant-bornes"
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] max-w-[240px] border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <p id="don-montant-bornes" className="text-caption text-text-muted">
            {tdon(frDonations.form.boundsHint, {
              min: formatDonationAmount(
                rule.minAmountMinor,
                rule.currency,
                rule.minorUnitExponent,
              ),
              max: formatDonationAmount(
                rule.maxAmountMinor,
                rule.currency,
                rule.minorUnitExponent,
              ),
            })}
            {rule.stepMinor > 1
              ? ` ${tdon(frDonations.form.stepHint, {
                  step: formatDonationAmount(
                    rule.stepMinor,
                    rule.currency,
                    rule.minorUnitExponent,
                  ),
                })}`
              : ''}
          </p>
          {state.fieldErrors['amountMinor'] ? (
            <p className="text-caption text-error">{state.fieldErrors['amountMinor']}</p>
          ) : null}
        </div>
      </fieldset>

      {/* Options ---------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="isAnonymous" value="1" className="mt-1" />
          <span className="flex flex-col gap-1">
            <span className="text-body-sm text-text-primary">
              {frDonations.form.anonymousLabel}
            </span>
            <span className="text-caption text-text-muted">
              {frDonations.form.anonymousDescription}
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <label htmlFor="don-message" className="text-body-sm text-text-primary font-medium">
            {frDonations.form.messageLabel}
          </label>
          <textarea
            id="don-message"
            name="message"
            rows={3}
            maxLength={500}
            placeholder={frDonations.form.messagePlaceholder}
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={isPending || !amountIsValid}>
          {isPending ? frDonations.form.submitPending : frDonations.form.submit}
        </Button>
        <p className="text-caption text-text-muted">{frDonations.form.submitHint}</p>
      </div>
    </form>
  );
}
