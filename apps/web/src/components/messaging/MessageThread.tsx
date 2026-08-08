'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frMessaging } from '@/i18n/messaging';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatTime, type MessageRow } from '@/lib/messaging-view';
import { loadOlderMessagesAction, sendMessageAction } from '@/app/messages/actions';

/**
 * ISE-097 — fil de messages.
 *
 * REGLE CARDINALE (D-83, MASTER PROMPT §34) — l'interface n'affiche
 * JAMAIS « Envoyé » avant l'accuse de reception du serveur.
 *   1. a la soumission, le message apparait en `pending` et porte le
 *      libelle « Envoi en cours… » ;
 *   2. il ne devient `sent` que lorsque `send_message()` a repondu avec
 *      l'identifiant du message PERSISTE ;
 *   3. si l'appel echoue, il passe en `failed`, reste visible, et
 *      propose « Réessayer l’envoi ».
 * Le meme `clientMessageId` est reutilise a chaque tentative : la
 * contrainte unique `(conversation_id, client_message_id)` garantit
 * qu'une reprise reseau ne cree pas de doublon.
 *
 * REALTIME (§34) — l'abonnement porte UNIQUEMENT sur les messages de la
 * conversation ouverte, avec un filtre serveur `conversation_id=eq.<id>`.
 * Rien n'est abonne a l'echelle de la plateforme. Les politiques RLS
 * s'appliquent au flux : un non-participant ne recoit rien, meme s'il
 * forgeait la souscription.
 *
 * ACCESSIBILITE — la liste est une region `aria-live="polite"` : les
 * messages qui arrivent sont annonces sans voler le focus. Le champ de
 * saisie garde le focus apres envoi. Les erreurs sont reliees par
 * `aria-describedby`.
 */

interface PendingMessage {
  clientMessageId: string;
  body: string;
  status: 'pending' | 'failed';
  error: string | null;
  correlationId: string | null;
}

function newClientMessageId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `cli-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function MessageThread({
  conversationId,
  viewerProfileId,
  initialMessages,
  initialOlderCursor,
  canReply,
  showReadReceipts,
  counterpartName,
}: {
  conversationId: string;
  viewerProfileId: string;
  /** Du plus ancien au plus recent. */
  initialMessages: readonly MessageRow[];
  /** Curseur scelle vers les messages PLUS ANCIENS. `null` = debut du fil. */
  initialOlderCursor: string | null;
  canReply: boolean;
  showReadReceipts: boolean;
  counterpartName: string;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([...initialMessages]);
  const [olderCursor, setOlderCursor] = useState<string | null>(initialOlderCursor);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [olderError, setOlderError] = useState<string | null>(null);
  const [isLoadingOlder, startLoadingOlder] = useTransition();
  const [isSending, startSending] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const errorId = `${conversationId}-erreur-envoi`;

  useEffect(() => {
    setMessages([...initialMessages]);
    setOlderCursor(initialOlderCursor);
  }, [initialMessages, initialOlderCursor]);

  /* ---------------------------------------------------------------- */
  /* Realtime : conversation OUVERTE uniquement (§34)                  */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const messageId = typeof row['id'] === 'string' ? row['id'] : null;
          if (messageId === null) return;
          const senderId =
            typeof row['sender_profile_id'] === 'string' ? row['sender_profile_id'] : null;

          setMessages((current) => {
            if (current.some((message) => message.messageId === messageId)) return current;
            return [
              ...current,
              {
                messageId,
                clientMessageId:
                  typeof row['client_message_id'] === 'string' ? row['client_message_id'] : null,
                messageType: typeof row['message_type'] === 'string' ? row['message_type'] : 'text',
                body: typeof row['body'] === 'string' ? row['body'] : null,
                deleted: row['deleted_at'] !== null && row['deleted_at'] !== undefined,
                createdAt: typeof row['created_at'] === 'string' ? row['created_at'] : null,
                editedAt: null,
                deliveryStatus: 'sent',
                fromMe: senderId === viewerProfileId,
                senderName: senderId === viewerProfileId ? null : counterpartName,
                readByOther: false,
                hasAttachments: row['has_attachments'] === true,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, viewerProfileId, counterpartName]);

  /* ---------------------------------------------------------------- */
  /* Envoi — D-83                                                      */
  /* ---------------------------------------------------------------- */
  const submit = useCallback(
    (clientMessageId: string, body: string) => {
      startSending(async () => {
        const result = await sendMessageAction(conversationId, body, clientMessageId);
        if (result.ok && result.messageId !== null) {
          setPending((current) =>
            current.filter((entry) => entry.clientMessageId !== clientMessageId),
          );
          setMessages((current) =>
            current.some((message) => message.messageId === result.messageId)
              ? current
              : [
                  ...current,
                  {
                    messageId: result.messageId as string,
                    clientMessageId,
                    messageType: 'text',
                    body,
                    deleted: false,
                    createdAt: result.createdAt,
                    editedAt: null,
                    deliveryStatus: 'sent',
                    fromMe: true,
                    senderName: null,
                    readByOther: false,
                    hasAttachments: false,
                  },
                ],
          );
          return;
        }
        setPending((current) =>
          current.map((entry) =>
            entry.clientMessageId === clientMessageId
              ? {
                  ...entry,
                  status: 'failed',
                  error: result.message,
                  correlationId: result.correlationId,
                }
              : entry,
          ),
        );
      });
    },
    [conversationId],
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (body.length === 0) return;
    const clientMessageId = newClientMessageId();
    setPending((current) => [
      ...current,
      { clientMessageId, body, status: 'pending', error: null, correlationId: null },
    ]);
    setDraft('');
    inputRef.current?.focus();
    submit(clientMessageId, body);
  };

  const loadOlder = () => {
    if (olderCursor === null) return;
    startLoadingOlder(async () => {
      const result = await loadOlderMessagesAction(conversationId, olderCursor);
      if (!result.ok) {
        setOlderError(result.message);
        return;
      }
      setOlderError(null);
      setMessages((current) => {
        const known = new Set(current.map((message) => message.messageId));
        return [...result.rows.filter((row) => !known.has(row.messageId)), ...current];
      });
      setOlderCursor(result.nextCursor);
    });
  };

  const announcement = useMemo(() => {
    const last = messages[messages.length - 1];
    if (last === undefined) return '';
    return last.fromMe ? '' : `${last.senderName ?? counterpartName} : ${last.body ?? ''}`;
  }, [messages, counterpartName]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {olderCursor !== null ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadOlder}
            loading={isLoadingOlder}
            loadingLabel={frMessaging.common.retry}
          >
            {frMessaging.common.loadOlder}
          </Button>
        </div>
      ) : null}

      {olderError !== null ? <Alert variant="error" title={olderError} /> : null}

      <ol
        aria-live="polite"
        aria-relevant="additions"
        aria-label={frMessaging.thread.ariaLabel}
        className="flex flex-col gap-4"
      >
        {messages.map((message) => (
          <li
            key={message.messageId}
            className={message.fromMe ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                message.fromMe
                  ? 'bg-primary text-body-sm max-w-[min(560px,85%)] rounded-lg px-5 py-4 text-white'
                  : 'border-border bg-surface text-body-sm text-text-primary max-w-[min(560px,85%)] rounded-lg border px-5 py-4'
              }
            >
              {!message.fromMe && message.senderName !== null ? (
                <p className="text-caption text-text-secondary mb-1 font-semibold">
                  {message.senderName}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap break-words">
                {message.deleted ? (
                  <em className={message.fromMe ? 'text-white/80' : 'text-text-muted'}>
                    {frMessaging.inbox.deletedMessage}
                  </em>
                ) : (
                  message.body
                )}
              </p>
              <p
                className={
                  message.fromMe
                    ? 'text-caption mt-2 text-white/80'
                    : 'text-caption text-text-muted mt-2'
                }
              >
                {formatTime(message.createdAt)}
                {message.fromMe ? (
                  <>
                    {' · '}
                    {showReadReceipts && message.readByOther
                      ? frMessaging.thread.statusRead
                      : frMessaging.thread.statusSent}
                  </>
                ) : null}
              </p>
            </div>
          </li>
        ))}

        {/* Messages LOCAUX : jamais annonces comme envoyes (D-83). */}
        {pending.map((entry) => (
          <li key={entry.clientMessageId} className="flex justify-end">
            <div
              className={
                entry.status === 'failed'
                  ? 'text-body-sm text-text-primary max-w-[min(560px,85%)] rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-5 py-4'
                  : 'text-body-sm text-text-primary max-w-[min(560px,85%)] rounded-lg border border-dashed border-[#93C5FD] bg-[#EFF6FF] px-5 py-4'
              }
            >
              <p className="whitespace-pre-wrap break-words">{entry.body}</p>
              <p className="text-caption text-text-muted mt-2">
                {entry.status === 'failed'
                  ? frMessaging.thread.statusFailed
                  : frMessaging.thread.statusPending}
              </p>
              {entry.status === 'failed' ? (
                <div className="mt-3 flex flex-col gap-2">
                  {entry.error !== null ? (
                    <p id={errorId} className="text-caption text-error">
                      {entry.error}
                      {entry.correlationId !== null
                        ? ` — ${frMessaging.common.correlationLabel} : ${entry.correlationId}`
                        : ''}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-describedby={entry.error !== null ? errorId : undefined}
                    onClick={() => {
                      setPending((current) =>
                        current.map((item) =>
                          item.clientMessageId === entry.clientMessageId
                            ? { ...item, status: 'pending', error: null, correlationId: null }
                            : item,
                        ),
                      );
                      submit(entry.clientMessageId, entry.body);
                    }}
                  >
                    {frMessaging.thread.retrySend}
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {canReply ? (
        <form onSubmit={onSubmit} className="border-border flex flex-col gap-3 border-t pt-5">
          <label
            htmlFor={`${conversationId}-composer`}
            className="text-body-sm text-text-primary font-medium"
          >
            {frMessaging.thread.composerLabel}
          </label>
          <textarea
            id={`${conversationId}-composer`}
            ref={inputRef}
            rows={3}
            value={draft}
            maxLength={5000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={frMessaging.thread.composerPlaceholder}
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue min-h-[88px] border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-text-muted">{frMessaging.thread.privacyNote}</p>
            <Button
              type="submit"
              loading={isSending}
              loadingLabel={frMessaging.thread.sending}
              disabled={draft.trim().length === 0}
            >
              {frMessaging.thread.send}
            </Button>
          </div>
          {/* D-84 : le televersement n'est pas livre, donc aucun bouton
              « Pièce jointe » n'est rendu. On le dit au lieu de le suggerer. */}
          <p className="text-caption text-text-muted">
            {frMessaging.thread.attachmentsUnavailable}
          </p>
        </form>
      ) : null}
    </div>
  );
}
