'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../utils/cx';
import { getFocusable } from '../utils/focus';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Phrase de contexte, liee au dialogue par `aria-describedby`. */
  description?: string;
  /** Zone d'actions en pied de dialogue. */
  footer?: ReactNode;
  /** 480 px · 560 px · 640 px. */
  size?: 'sm' | 'md' | 'lg';
  /** Desactive la fermeture par Echap et par clic sur le fond. */
  dismissible?: boolean;
  children?: ReactNode;
}

const SIZES = { sm: 'max-w-[480px]', md: 'max-w-[560px]', lg: 'max-w-[640px]' } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  dismissible = true,
  children,
}: ModalProps) {
  const base = useId();
  const titleId = `${base}-title`;
  const descriptionId = `${base}-description`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const requestClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  // Piege a focus, Echap, restitution du focus et blocage du defilement.
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel ? getFocusable(panel)[0] : undefined;
    (first ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === firstEl || active === panelRef.current)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, requestClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div className="bg-dark-navy/50 absolute inset-0" aria-hidden="true" onClick={requestClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description ? { 'aria-describedby': descriptionId } : {})}
        tabIndex={-1}
        className={cx(
          'border-border bg-surface relative z-10 flex w-full flex-col gap-5 rounded-xl border p-7 shadow-lg',
          'max-h-[calc(100vh-40px)] overflow-y-auto focus:outline-none',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className="text-h3 text-text-primary font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-body-sm text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <IconButton
              label="Fermer"
              icon={<CloseIcon width={18} height={18} />}
              onClick={onClose}
              className="-mr-2 -mt-2"
            />
          ) : null}
        </div>

        {children ? <div className="text-body-sm text-text-secondary">{children}</div> : null}
        {footer ? <div className="flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
