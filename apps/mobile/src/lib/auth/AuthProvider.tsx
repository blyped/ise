import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { signInSchema } from '@ise/validation';

import { authErrorMessage } from '../auth-errors';
import { newCorrelationId } from '../correlation';
import { getSupabaseClient } from '../supabase/client';

/**
 * Porte d'authentification unique du mobile — equivalent fonctionnel de
 * `apps/web/src/middleware.ts` + `src/lib/supabase/middleware.ts` (D-155).
 *
 * Le web protege ses routes cote serveur, a chaque requete, avant que la
 * page ne s'affiche. Une application mobile n'a pas de serveur intercalé
 * entre l'ecran et l'utilisateur : la garde doit donc vivre dans l'arbre de
 * composants, au point d'entree de la navigation
 * (`src/navigation/RootNavigator.tsx`), qui bascule entre l'ecran de
 * connexion et les onglets applicatifs selon `session`.
 *
 * Trois etats explicites, jamais un ecran blanc pendant l'incertitude
 * (D-93) :
 *  - `loading: true` — la session n'a pas encore ete lue depuis le stockage
 *    securise (`RootNavigator` affiche un etat de chargement) ;
 *  - `session: null` — aucune session valide (`RootNavigator` affiche
 *    `AuthStack`) ;
 *  - `session` present — membre authentifie (`RootNavigator` affiche
 *    `AppTabs`).
 */
export interface SignInResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly correlationId?: string;
  readonly fieldErrors?: Record<string, string>;
}

interface AuthContextValue {
  readonly session: Session | null;
  readonly user: User | null;
  readonly loading: boolean;
  signIn(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,

      /**
       * ISE-001 — Connexion. Le meme schema Zod que le web
       * (`@ise/validation#signInSchema`) est rejoue ici : le serveur
       * Supabase reste l'autorite reelle, mais l'erreur de saisie est
       * signalee avant tout appel reseau (MASTER PROMPT §62).
       */
      async signIn(email: string, password: string): Promise<SignInResult> {
        const correlationId = newCorrelationId();
        const parsed = signInSchema.safeParse({ email, password, rememberMe: true });

        if (!parsed.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            const key = issue.path[0];
            if (typeof key === 'string' && !(key in fieldErrors)) {
              fieldErrors[key] = issue.message;
            }
          }
          return { ok: false, correlationId, fieldErrors };
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error) {
          console.error('[ISE mobile] connexion refusée', { correlationId, code: error.code });
          return { ok: false, message: authErrorMessage(error), correlationId };
        }

        return { ok: true };
      },

      async signOut(): Promise<void> {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être appelé sous <AuthProvider>.');
  return ctx;
}
