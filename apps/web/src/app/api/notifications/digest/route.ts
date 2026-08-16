import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ise/db-types';
import { serverEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/resend';
import { newCorrelationId } from '@/lib/correlation';
import { frSignal, tsig } from '@/i18n/signal';
import { frOpportunities } from '@/i18n/opportunities';
import { frCalls } from '@/i18n/calls';

/**
 * COURRIER HEBDOMADAIRE DES SIGNAUX (D-221).
 *
 * Declenchee par le cron Vercel (`vercel.json`, lundi 08h00 UTC). Vercel
 * joint automatiquement `Authorization: Bearer ${CRON_SECRET}` a ses
 * appels de cron des que la variable d'environnement CRON_SECRET est
 * posee sur le projet : cette route REFUSE de tourner sans elle (503) et
 * refuse tout appel qui ne la porte pas (401) — personne ne peut faire
 * partir 250 e-mails en devinant une URL.
 *
 * CE QUE CE COURRIER EST : le canal « personne ne rate l'essentiel » de la
 * circulation des signaux. Les meilleurs profils d'un signal (score >= 75)
 * sont deja prevenus in-app a la publication ; TOUT le reste du reseau
 * recoit ici, une fois par semaine, la liste des signaux publies — avec,
 * pour les membres dont le profil correspondait moyennement (palier
 * `digest`), une ligne personnalisee les invitant a regarder.
 *
 * CE QU'IL N'EST PAS : jamais un e-mail par signal (anti-spam), jamais de
 * donnee qu'un membre connecte ne pourrait pas deja voir. Un e-mail en
 * echec n'interrompt pas la tournee : on journalise et on continue.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DigestItem {
  readonly id: string;
  readonly title: string;
  readonly type?: string;
  readonly organization?: string | null;
  readonly starts_at?: string;
}

function asItems(value: unknown): readonly DigestItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DigestItem =>
      typeof item === 'object' && item !== null &&
      typeof (item as Record<string, unknown>)['id'] === 'string' &&
      typeof (item as Record<string, unknown>)['title'] === 'string',
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function opportunityTypeLabel(type: string | undefined): string {
  return (type !== undefined && frOpportunities.type[type]) || '';
}

function callTypeLabel(type: string | undefined): string {
  return (type !== undefined && frCalls.type[type]) || '';
}

function sectionHtml(title: string, rows: readonly string[]): string {
  if (rows.length === 0) return '';
  return (
    `<h3 style="margin:20px 0 8px">${escapeHtml(title)}</h3>` +
    `<ul style="margin:0;padding-left:18px">` +
    rows.map((row) => `<li style="margin:4px 0">${row}</li>`).join('') +
    `</ul>`
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = newCorrelationId();

  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret === undefined || cronSecret.length === 0) {
    console.error('[ISE] digest : CRON_SECRET absent, envoi refuse', { correlationId });
    return NextResponse.json({ error: 'cron_secret_missing' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const env = serverEnv();
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

  const [contentResult, recipientsResult] = await Promise.all([
    client.rpc('weekly_digest_content'),
    client.rpc('weekly_digest_recipients'),
  ]);

  if (contentResult.error || recipientsResult.error) {
    console.error('[ISE] digest : lecture impossible', {
      correlationId,
      contentError: contentResult.error?.code,
      recipientsError: recipientsResult.error?.code,
    });
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }

  const content =
    typeof contentResult.data === 'object' && contentResult.data !== null
      ? (contentResult.data as Record<string, unknown>)
      : {};
  const opportunities = asItems(content['opportunities']);
  const calls = asItems(content['network_calls']);
  const events = asItems(content['events']);

  // Semaine sans le moindre signal : aucun courrier. Un digest vide
  // n'apprendrait rien et fatiguerait la liste.
  if (opportunities.length === 0 && calls.length === 0 && events.length === 0) {
    console.info('[ISE] digest : semaine sans signaux, aucun envoi', { correlationId });
    return NextResponse.json({ sent: 0, skipped: 'no_content' });
  }

  const recipients = Array.isArray(recipientsResult.data) ? recipientsResult.data : [];

  const oppRows = opportunities.map((item) => {
    const label = opportunityTypeLabel(item.type);
    const org = item.organization ? ` — ${escapeHtml(item.organization)}` : '';
    return `<a href="${siteUrl}/opportunites/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a>${label ? ` <em>(${escapeHtml(label)})</em>` : ''}${org}`;
  });
  const callRows = calls.map((item) => {
    const label = callTypeLabel(item.type);
    return `<a href="${siteUrl}/appels/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a>${label ? ` <em>(${escapeHtml(label)})</em>` : ''}`;
  });
  const eventRows = events.map((item) => {
    const date =
      item.starts_at !== undefined
        ? ` — ${new Date(item.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
        : '';
    return `<a href="${siteUrl}/evenements/${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a>${date}`;
  });

  const bodyHtml =
    sectionHtml(frSignal.digestEmail.opportunitiesTitle, oppRows) +
    sectionHtml(frSignal.digestEmail.callsTitle, callRows) +
    sectionHtml(frSignal.digestEmail.eventsTitle, eventRows);

  const textLines = [
    ...(opportunities.length > 0
      ? [frSignal.digestEmail.opportunitiesTitle, ...opportunities.map((o) => `- ${o.title}`)]
      : []),
    ...(calls.length > 0
      ? [frSignal.digestEmail.callsTitle, ...calls.map((c) => `- ${c.title}`)]
      : []),
    ...(events.length > 0
      ? [frSignal.digestEmail.eventsTitle, ...events.map((e) => `- ${e.title}`)]
      : []),
  ].join('\n');

  let sent = 0;
  let failed = 0;
  const CONCURRENCY = 10;
  for (let index = 0; index < recipients.length; index += CONCURRENCY) {
    const batch = recipients.slice(index, index + CONCURRENCY);
    // Chaque envoi est independant : un echec est compte, jamais bloquant.
    const results = await Promise.all(
      batch.map(async (recipient) => {
        const email = typeof recipient.email === 'string' ? recipient.email : null;
        if (email === null) return false;
        const name =
          typeof recipient.display_name === 'string' && recipient.display_name.length > 0
            ? recipient.display_name
            : null;
        const matchCount = typeof recipient.match_count === 'number' ? recipient.match_count : 0;

        const greeting =
          name !== null
            ? tsig(frSignal.digestEmail.greeting, { name })
            : frSignal.digestEmail.greetingFallback;
        const matchHtml =
          matchCount > 0
            ? `<p style="font-weight:600">${escapeHtml(tsig(frSignal.digestEmail.matchLine, { count: matchCount }))}</p>`
            : '';

        const result = await sendEmail({
          to: email,
          subject: frSignal.digestEmail.subject,
          html:
            `<p>${escapeHtml(greeting)}</p>` +
            `<p>${escapeHtml(frSignal.digestEmail.intro)}</p>` +
            matchHtml +
            bodyHtml +
            `<p style="margin-top:24px"><a href="${siteUrl}/tableau-de-bord">${escapeHtml(frSignal.digestEmail.cta)}</a></p>` +
            `<p style="margin-top:24px;color:#64748B;font-size:12px">${escapeHtml(frSignal.digestEmail.optOutNote)}</p>`,
          text: `${greeting}\n\n${frSignal.digestEmail.intro}\n\n${textLines}\n\n${frSignal.digestEmail.cta} : ${siteUrl}/tableau-de-bord\n\n${frSignal.digestEmail.optOutNote}`,
        });
        return result.ok;
      }),
    );
    sent += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;
  }

  console.info('[ISE] digest : tournee terminee', {
    correlationId,
    recipients: recipients.length,
    sent,
    failed,
    signals: { opportunities: opportunities.length, calls: calls.length, events: events.length },
  });

  return NextResponse.json({ sent, failed, recipients: recipients.length });
}
