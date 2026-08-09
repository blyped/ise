import { serverEnv } from '@/lib/env';

/**
 * Couche d'abstraction e-mail (MASTER PROMPT §68, `.env.example`).
 *
 * Cote serveur uniquement (D-100) : n'est jamais importe par un composant
 * client, au meme titre que `lib/queries/*` qui depend de `next/headers`.
 *
 * `EMAIL_PROVIDER=console` (par defaut) : rien n'est envoye, seulement
 * journalise — comportement honnete pour le developpement local, jamais un
 * echec silencieux qui ferait croire qu'un message est parti.
 * `EMAIL_PROVIDER=resend` : appel direct a l'API HTTP de Resend, cote
 * serveur uniquement (D-100 : `EMAIL_API_KEY` ne quitte jamais le serveur).
 *
 * Ce module ne fait AUCUNE hypothese sur le contenu : il transporte un
 * sujet et un corps HTML deja composes par l'appelant (i18n reste dans les
 * catalogues `fr.ts` / `promotions.ts`, jamais ici).
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Reduit au strict minimum le texte brut pour les clients qui l'exigent. */
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Identifiant du fournisseur, pour correler un incident sans stocker le contenu. */
  providerMessageId: string | null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = serverEnv();

  if (env.EMAIL_PROVIDER === 'console') {
    console.info('[ISE] e-mail (mode console, rien n’est envoye)', {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, providerMessageId: null };
  }

  if (env.EMAIL_PROVIDER !== 'resend') {
    console.error('[ISE] fournisseur e-mail non implemente', { provider: env.EMAIL_PROVIDER });
    return { ok: false, providerMessageId: null };
  }

  if (!env.EMAIL_API_KEY) {
    console.error('[ISE] EMAIL_API_KEY manquante : envoi Resend impossible');
    return { ok: false, providerMessageId: null };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });

    if (!response.ok) {
      console.error('[ISE] envoi Resend refuse', { status: response.status });
      return { ok: false, providerMessageId: null };
    }

    const payload = (await response.json()) as { id?: string };
    return { ok: true, providerMessageId: payload.id ?? null };
  } catch (error) {
    console.error('[ISE] envoi Resend en echec', {
      message: error instanceof Error ? error.message : 'inconnu',
    });
    return { ok: false, providerMessageId: null };
  }
}
