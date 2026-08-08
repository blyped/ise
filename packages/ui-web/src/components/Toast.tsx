'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '../utils/cx';
import { IconButton } from './IconButton';
import { AlertIcon, CheckIcon, CloseIcon, ErrorIcon, InfoIcon } from './icons';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  /**
   * Confirmation courte uniquement : une information critique ne doit jamais
   * vivre seulement dans un toast.
   */
  showToast: (tone: ToastTone, message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<ToastTone, { box: string; icon: ReactNode; prefix: string }> = {
  success: {
    box: 'border-[#BBF7D0] bg-[#F0FDF4] text-success',
    icon: <CheckIcon width={18} height={18} />,
    prefix: 'Succès',
  },
  error: {
    box: 'border-[#FECACA] bg-[#FEF2F2] text-error',
    icon: <ErrorIcon width={18} height={18} />,
    prefix: 'Erreur',
  },
  info: {
    box: 'border-[#BFDBFE] bg-[#EFF6FF] text-info',
    icon: <InfoIcon width={18} height={18} />,
    prefix: 'Information',
  },
};

export function ToastProvider({
  children,
  durationMs = 5000,
}: {
  children: ReactNode;
  durationMs?: number;
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { id, tone, message }]);
      if (durationMs > 0) {
        window.setTimeout(() => dismissToast(id), durationMs);
      }
    },
    [dismissToast, durationMs],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-40px))] flex-col gap-3"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={cx(
                'rounded-base pointer-events-auto flex items-start gap-3 border p-4 shadow-md',
                tone.box,
              )}
            >
              <span className="mt-[2px] shrink-0" aria-hidden="true">
                {tone.icon}
              </span>
              <p className="text-body-sm text-text-primary flex-1">
                <span className="sr-only">{tone.prefix} : </span>
                {toast.message}
              </p>
              <IconButton
                label="Fermer la notification"
                icon={<CloseIcon width={16} height={16} />}
                size="sm"
                onClick={() => dismissToast(toast.id)}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé à l’intérieur d’un ToastProvider.');
  }
  return context;
}

export function ToastAlert({ tone, message }: { tone: ToastTone; message: string }) {
  const style = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-base flex items-start gap-3 border p-4', style.box)}
    >
      <span className="mt-[2px] shrink-0" aria-hidden="true">
        {tone === 'error' ? <AlertIcon width={18} height={18} /> : style.icon}
      </span>
      <p className="text-body-sm text-text-primary">
        <span className="sr-only">{style.prefix} : </span>
        {message}
      </p>
    </div>
  );
}
