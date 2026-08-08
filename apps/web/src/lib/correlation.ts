/**
 * Identifiant de correlation affiche a l'utilisateur en cas d'erreur (D-102).
 * C'est le seul element technique montre : jamais de trace, jamais de SQL.
 * Le meme identifiant est journalise cote serveur pour retrouver l'incident.
 */
export function newCorrelationId(): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2).padEnd(12, '0');
  return `ISE-${random.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}
