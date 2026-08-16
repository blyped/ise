'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@ise/ui-web';
import { frDonations, tdon } from '@/i18n/donations';
import {
  amountMatchesRule,
  formatDonationAmount,
  initialDonationFormState,
  parseAmountToMinor,
  type DonationCurrencyRule,
  type DonationProvider,
} from '@/lib/donations/shared';
import { donationReturnRoute } from '@/lib/routes/donations';
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
 *
 * D-218 (16/08/2026) — GUICHET CINETPAY EN POPUP, PAS EN REDIRECTION.
 *
 * Stripe garde son comportement d'origine : `startDonationAction` appelle
 * `redirect()` cote serveur, la page hebergee de Stripe s'ouvre en
 * navigation pleine page (le formulaire n'a rien de plus a faire).
 *
 * CinetPay, lui, ne redirige plus : l'action renvoie un `checkout` (jeton +
 * URL du guichet), et c'est ce composant qui charge le SDK officiel
 * `cinetpay-seamless` (charge depuis son CDN, PAS installe en dependance
 * npm — cf. le commentaire de `lib/donations/stripe.ts` sur le risque de
 * verrou `pnpm-lock.yaml` incoherent dans ce bac a sable) et ouvre le
 * guichet dans une fenetre : le donateur ne quitte jamais Competences ISE.
 *
 * LA VERITE DU PAIEMENT NE VIENT TOUJOURS PAS D'ICI. Que le SDK rapporte un
 * succes, un echec ou une simple fermeture de fenetre, ce composant ne fait
 * jamais qu'une chose : renvoyer le donateur vers `/don/retour`, qui relit
 * l'etat REEL en base (etabli par la notification serveur a serveur — seule
 * source qui compte, voir `lib/donations/settle.ts`).
 */

const CINETPAY_SEAMLESS_SCRIPT_URL =
  'https://unpkg.com/cinetpay-seamless@0.1.5/dist/cinetpay-seamless.umd.cjs';
const CINETPAY_SEAMLESS_SCRIPT_ID = 'cinetpay-seamless-sdk';

interface CinetpaySeamlessPaymentResponse {
  readonly transactionId?: string;
  readonly status?: string;
}

interface CinetpaySeamlessError {
  readonly code?: string;
  readonly message?: string;
}

interface CinetpaySeamlessOpenConfig {
  readonly paymentToken: string;
  readonly paymentUrl?: string;
  readonly statusUrl?: string;
  readonly statusPollInterval?: number;
  readonly debug?: boolean;
  readonly onPaymentSuccess?: (data: CinetpaySeamlessPaymentResponse) => void;
  readonly onPaymentFailed?: (data: CinetpaySeamlessPaymentResponse) => void;
  readonly onPaymentPending?: (data: CinetpaySeamlessPaymentResponse) => void;
  readonly onClose?: (info: { status?: string }) => void;
  readonly onError?: (error: CinetpaySeamlessError) => void;
}

interface CinetpaySeamlessGlobal {
  readonly open: (config: CinetpaySeamlessOpenConfig) => void;
  readonly close: () => void;
}

type WindowWithCinetpaySeamless = typeof window & {
  CinetPaySeamless?: CinetpaySeamlessGlobal;
};

/**
 * Charge le SDK une seule fois par page, meme si le donateur ouvre
 * plusieurs guichets successifs (retour d'erreur puis nouvel essai). Un
 * `<script>` deja present (ou deja charge) est reutilise tel quel.
 */
function loadCinetpaySeamless(): Promise<CinetpaySeamlessGlobal> {
  return new Promise((resolve, reject) => {
    const withGlobal = window as WindowWithCinetpaySeamless;
    if (withGlobal.CinetPaySeamless) {
      resolve(withGlobal.CinetPaySeamless);
      return;
    }

    const existing = document.getElementById(CINETPAY_SEAMLESS_SCRIPT_ID);
    if (existing !== null) {
      existing.addEventListener('load', () => {
        const loaded = (window as WindowWithCinetpaySeamless).CinetPaySeamless;
        if (loaded) resolve(loaded);
        else reject(new Error('cinetpay_seamless_unavailable'));
      });
      existing.addEventListener('error', () => reject(new Error('cinetpay_seamless_load_failed')));
      return;
    }

    const script = document.createElement('script');
    script.id = CINETPAY_SEAMLESS_SCRIPT_ID;
    script.src = CINETPAY_SEAMLESS_SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', () => {
      const loaded = (window as WindowWithCinetpaySeamless).CinetPaySeamless;
      if (loaded) resolve(loaded);
      else reject(new Error('cinetpay_seamless_unavailable'));
    });
    script.addEventListener('error', () => reject(new Error('cinetpay_seamless_load_failed')));
    document.head.appendChild(script);
  });
}

export function DonationForm({ rules }: { rules: readonly DonationCurrencyRule[] }) {
  const [state, formAction, isPending] = useActionState(
    startDonationAction,
    initialDonationFormState,
  );
  const router = useRouter();

  const firstRule = rules[0];
  const [provider, setProvider] = useState<DonationProvider>(firstRule?.provider ?? 'cinetpay');
  const [presetAmount, setPresetAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  // D-218 — un seul guichet CinetPay ouvert par reference de don : evite de
  // rouvrir la popup a chaque nouveau rendu (ex. l'utilisateur tape dans un
  // champ pendant que la popup est deja ouverte).
  const openedReferenceRef = useRef<string | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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

  useEffect(() => {
    const checkout = state.checkout;
    if (checkout === null) return;
    if (openedReferenceRef.current === checkout.reference) return;
    if (checkout.paymentToken === null) {
      // Pas de jeton exploitable par le SDK : le lien de secours (rendu
      // plus bas) reste la seule voie, on ne tente pas d'ouvrir de popup.
      setGatewayError(null);
      return;
    }

    openedReferenceRef.current = checkout.reference;
    setGatewayError(null);
    setAwaitingConfirmation(false);

    let cancelled = false;
    const reference = checkout.reference;
    const goToReturnPage = () => router.push(donationReturnRoute(reference));

    loadCinetpaySeamless()
      .then((seamless) => {
        if (cancelled) return;
        seamless.open({
          paymentToken: checkout.paymentToken as string,
          paymentUrl: checkout.paymentUrl,
          // Verifie l'etat CANONIQUE (notre base, mise a jour par la
          // notification serveur a serveur) plutot que de se fier au seul
          // `postMessage` du guichet, que certains flux mobile money
          // n'emettent jamais.
          statusUrl: `/api/dons/statut?ref=${encodeURIComponent(reference)}`,
          statusPollInterval: 4000,
          onPaymentPending: () => setAwaitingConfirmation(true),
          onPaymentSuccess: goToReturnPage,
          onPaymentFailed: goToReturnPage,
          onClose: goToReturnPage,
          onError: (error) => {
            setGatewayError(
              error.code === 'POPUP_BLOCKED'
                ? frDonations.form.errorPopupBlocked
                : frDonations.form.errorGateway,
            );
          },
        });
      })
      .catch(() => {
        if (!cancelled) setGatewayError(frDonations.form.errorPopupBlocked);
      });

    return () => {
      cancelled = true;
    };
  }, [state.checkout, router]);

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

      {/* D-218 — guichet CinetPay ouvert (ou en train de s'ouvrir). Le lien
          de secours reste toujours disponible : une popup bloquee, ou un
          SDK qui ne charge pas, ne doit jamais bloquer le don. */}
      {state.checkout !== null ? (
        <div className="flex flex-col gap-3">
          {gatewayError !== null ? (
            <Alert variant="warning" title={gatewayError} />
          ) : awaitingConfirmation ? (
            <Alert variant="info" title={frDonations.form.paymentPendingNotice} />
          ) : (
            <Alert variant="info" title={frDonations.form.openingGateway} />
          )}
          <a
            href={state.checkout.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-base border-primary text-primary-hover inline-flex min-h-[44px] items-center justify-center border bg-[#EFF6FF] px-5 text-body-sm font-semibold"
          >
            {frDonations.form.openGatewayManually}
          </a>
        </div>
      ) : null}
    </form>
  );
}
