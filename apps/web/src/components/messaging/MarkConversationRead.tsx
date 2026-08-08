'use client';

import { useEffect } from 'react';
import { markConversationReadOnOpenAction } from '@/app/messages/actions';

/**
 * ISE-097 — pose l'accuse de lecture a l'ouverture du fil.
 *
 * Le composant ne rend RIEN : il n'y a pas de bouton « j'ai lu », parce
 * qu'ouvrir la conversation EST l'evenement de lecture. Le compteur mis
 * a zero est celui du lecteur seul (`conversation_participants` de sa
 * ligne) : il n'affecte ni l'autre participant ni son propre compteur.
 */
export function MarkConversationRead({
  conversationId,
  unreadCount,
}: {
  conversationId: string;
  unreadCount: number;
}) {
  useEffect(() => {
    if (unreadCount <= 0) return;
    void markConversationReadOnOpenAction(conversationId);
  }, [conversationId, unreadCount]);

  return null;
}
