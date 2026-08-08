'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@ise/ui-web';

/**
 * Confirmation d'une action SENSIBLE et irreversible
 * (MASTER PROMPT §48 : suppression de compte, blocage, révocation).
 *
 * REGLES APPLIQUEES
 *   * l'action n'est jamais executee au clic d'ouverture : le dialogue
 *     n'est qu'un rappel de ce qui va se passer, la confirmation est un
 *     second geste, explicite ;
 *   * lorsqu'un `confirmationPhrase` est fourni, le bouton de
 *     confirmation reste desactive tant que la phrase n'est pas saisie
 *     exactement — et la BASE le revalide de son cote ;
 *   * `role="dialog"` + `aria-modal`, focus place sur le premier
 *     element, `Echap` ferme, le focus revient sur le declencheur ;
 *   * aucune mise en file hors connexion (§46) : le formulaire est
 *     soumis immediatement ou echoue, et le dialogue le dit.
 */
export interface SensitiveActionDialogProps {
  triggerLabel: string;
  title: string;
  /** Ce que l'action fait exactement. Jamais un texte vague. */
  description: ReactNode;
  confirmLabel: string;
  /** Phrase a recopier, ex. « SUPPRIMER ». `null` = simple confirmation. */
  confirmationPhrase?: string | null;
  confirmationLabel?: string;
  confirmationHint?: string;
  /** Champ de formulaire portant la phrase saisie. */
  confirmationFieldName?: string;
  /** Rendu du formulaire : recoit les champs a inclure. */
  children: (confirmation: string) => ReactNode;
  pending?: boolean;
  offlineNotice?: string;
  destructive?: boolean;
}

export function SensitiveActionDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  confirmationPhrase = null,
  confirmationLabel,
  confirmationHint,
  children,
  pending = false,
  offlineNotice,
  destructive = true,
}: SensitiveActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const base = useId();
  const titleId = `${base}-title`;
  const descriptionId = `${base}-description`;
  const inputId = `${base}-confirmation`;
  const hintId = `${base}-hint`;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('input, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const matches =
    confirmationPhrase === null || confirmation.trim().toUpperCase() === confirmationPhrase;

  if (!open) {
    return (
      <Button
        ref={triggerRef}
        type="button"
        variant={destructive ? 'danger' : 'secondary'}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ref={panelRef}
      className="flex flex-col gap-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-6"
    >
      <div className="flex flex-col gap-3">
        <h3 id={titleId} className="text-h3 text-text-primary font-semibold">
          {title}
        </h3>
        <div id={descriptionId} className="text-body-sm text-text-secondary flex flex-col gap-3">
          {description}
        </div>
      </div>

      {confirmationPhrase !== null ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-body-sm text-text-primary font-medium">
            {confirmationLabel ?? `Pour confirmer, saisissez ${confirmationPhrase}`}
          </label>
          <input
            id={inputId}
            type="text"
            value={confirmation}
            autoComplete="off"
            aria-describedby={confirmationHint ? hintId : undefined}
            onChange={(event) => setConfirmation(event.target.value)}
            className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue h-[44px] border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          {confirmationHint ? (
            <p id={hintId} className="text-caption text-text-muted">
              {confirmationHint}
            </p>
          ) : null}
        </div>
      ) : null}

      {offlineNotice ? <p className="text-caption text-text-muted">{offlineNotice}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {children(confirmation)}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setConfirmation('');
            triggerRef.current?.focus();
          }}
          disabled={pending}
        >
          Annuler
        </Button>
      </div>

      <p aria-live="polite" className="sr-only">
        {matches ? `${confirmLabel} est maintenant disponible.` : ''}
      </p>
    </div>
  );
}
