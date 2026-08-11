/**
 * Identifiant de correlation affiche a l'utilisateur en cas d'erreur (D-102).
 * Copie fidele de `apps/web/src/lib/correlation.ts` : ce n'est pas un module
 * partage (trop petit, sans dependance), mais la MEME regle doit produire le
 * MEME format des deux cotes pour qu'un identifiant releve sur mobile se
 * retrouve sans ambiguite dans les journaux serveur.
 */
interface MinimalCrypto {
  randomUUID?: () => string;
}

export function newCorrelationId(): string {
  const cryptoObj = (globalThis as { crypto?: MinimalCrypto }).crypto;
  const random =
    typeof cryptoObj?.randomUUID === 'function'
      ? cryptoObj.randomUUID()
      : Math.random().toString(16).slice(2).padEnd(12, '0');
  return `ISE-${random.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}
