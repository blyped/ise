'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@ise/ui-web';
import { fr } from '@/i18n/fr';

/**
 * SYS-010 — Connexion perdue.
 *
 * Bandeau GLOBAL monte dans le layout racine :
 *  · detection par les evenements `online` / `offline` (navigator.onLine)
 *    ET par une verification reelle — un `fetch` HEAD sur l'origine — car
 *    `navigator.onLine` peut mentir dans les deux sens ;
 *  · `role="status"` + `aria-live="polite"` : l'etat est annonce aux
 *    technologies d'assistance sans interrompre la tache en cours ;
 *  · reprise AUTOMATIQUE : au retour du reseau, la verification est
 *    relancee et le bandeau se retire de lui-meme ;
 *  · AUCUNE promesse de synchronisation : rien n'est mis en file hors
 *    connexion (les §45-46 du MASTER PROMPT concernent le mobile), et le
 *    texte le dit.
 */

const RECHECK_INTERVAL_MS = 15_000;
const RESTORED_NOTICE_MS = 4_000;

async function checkConnectivity(): Promise<boolean> {
  try {
    await fetch('/', { method: 'HEAD', cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

export function ConnectionLostBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [justRestored, setJustRestored] = useState(false);
  const offlineRef = useRef(offline);
  offlineRef.current = offline;

  const verify = useCallback(async () => {
    setChecking(true);
    const online = await checkConnectivity();
    setChecking(false);
    if (online) {
      if (offlineRef.current) {
        setJustRestored(true);
        window.setTimeout(() => setJustRestored(false), RESTORED_NOTICE_MS);
      }
      setOffline(false);
    } else {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    // Reprise automatique : le retour du reseau declenche une verification
    // reelle, pas une simple confiance en `navigator.onLine`.
    const onOnline = () => void verify();

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [verify]);

  // Tant que la connexion est perdue, re-verifie periodiquement : certains
  // retours de reseau (VPN, portail captif) n'emettent pas `online`.
  useEffect(() => {
    if (!offline) return;
    const id = window.setInterval(() => void verify(), RECHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [offline, verify]);

  const c = fr.system.connectionLost;

  return (
    <div role="status" aria-live="polite">
      {offline ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 shadow-lg">
          <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#A16207]"
                aria-hidden="true"
              >
                <WifiOff size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-[#92400E]">
                  {c.title} — {c.body}
                </p>
                <p className="text-caption mt-1 text-[#92400E]">{c.hint}</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void verify()}
              loading={checking}
              loadingLabel={c.retrying}
            >
              {c.retry}
            </Button>
          </div>
        </div>
      ) : justRestored ? (
        <p className="fixed inset-x-0 bottom-0 z-50 border-t border-[#BBF7D0] bg-[#F0FDF4] px-5 py-3 text-center text-[13px] font-medium text-[#15803D]">
          {c.restored}
        </p>
      ) : null}
    </div>
  );
}
