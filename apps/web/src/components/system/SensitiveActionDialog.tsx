'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@ise/ui-web';

/**
 * SYS-007 — Confirmation d'une action SENSIBLE et irreversible
 * (MASTER PROMPT §48 : suppression de compte, blocage, révocation).
 *
 * REGLES APPLIQUEES
 *   * l'action n'est jamais executee au clic d'ouverture : le dialogue
 *     n'est qu'un rappel de ce qui va se passer, la confirmation est un
 *     second geste, explicite ;
 *   * lorsqu'un `confirmationPhrase` est fourni, le bouton de
 *     confirmation reste desactive tant que la phrase n'est pas saisie
 *     exactement — et la BASE le revalide de son cote ;
 *   * la CONSEQUENCE est nommee precisement (`description`), ce qui n'est
 *     PAS touche est liste (`preservedItems`), l'information « a savoir »
 *     est distincte (`notice`) : c'est la structure de la maquette SYS-007 ;
 *   * `role="dialog"` + `aria-modal`, rendu en surimpression avec fond
 *     assombri, focus place sur le premier element, `Echap` ferme, le
 *     focus revient sur le declencheur ;
 *   * aucune mise en file hors connexion (§46) : le formulaire est
 *     soumis immediatement ou echoue, et le dialogue le dit.
 *
 * Reutilisations recensees (matrice, MASTER PROMPT §94) : suppression de
 * compte (ISE-099 / SYS-008), blocage d'un membre (messagerie ISE-097),
 * actions de moderation et de roles du back-office (`ReasonAction`),
 * actions destructrices du CMS (`DangerAction`).
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
  /** Titre de la liste « Ce qui ne sera pas supprimé ». */
  preservedTitle?: string;
  /** Elements REELLEMENT conserves apres l'action. */
  preservedItems?: readonly string[];
  /** Encadre « À savoir » : information utile, jamais une promesse. */
  noticeTitle?: string;
  notice?: string;
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
  preservedTitle,
  preservedItems,
  noticeTitle,
  notice,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0F172A]/70 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={panelRef}
        className="bg-surface flex w-full max-w-[580px] flex-col gap-5 rounded-lg p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#B91C1C]"
            aria-hidden="true"
          >
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id={titleId} className="text-h3 text-text-primary font-semibold">
              {title}
            </h3>
            <div
              id={descriptionId}
              className="text-body-sm text-text-secondary mt-2 flex flex-col gap-3"
            >
              {description}
            </div>
          </div>
        </div>

        {preservedItems && preservedItems.length > 0 ? (
          <div>
            {preservedTitle ? (
              <h4 className="text-body-sm text-text-primary font-semibold">{preservedTitle}</h4>
            ) : null}
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
              {preservedItems.map((item) => (
                <li key={item} className="text-body-sm text-text-secondary">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-base border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
            {noticeTitle ? (
              <p className="text-caption font-semibold text-[#92400E]">{noticeTitle}</p>
            ) : null}
            <p className="text-caption mt-1 text-[#92400E]">{notice}</p>
          </div>
        ) : null}

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

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
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

        <p className="text-caption text-text-muted">
          Cette action nécessite une confirmation explicite.
        </p>

        <p aria-live="polite" className="sr-only">
          {matches ? `${confirmLabel} est maintenant disponible.` : ''}
        </p>
      </div>
    </div>
  );
}
