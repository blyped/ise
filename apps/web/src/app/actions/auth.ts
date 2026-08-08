'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/routes';

/**
 * Deconnexion. Server Action : la session est detruite cote serveur et les
 * cookies Supabase sont effaces. Volontairement declenchee par un POST —
 * une deconnexion sur simple GET serait exploitable en CSRF.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(ROUTES.signIn);
}
