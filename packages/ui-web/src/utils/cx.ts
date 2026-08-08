/**
 * `number` et `bigint` sont acceptes parce que `noeud && 'classe'` produit
 * `0` ou `0n` lorsque le noeud est vide : ces valeurs sont simplement ignorees.
 */
export type ClassValue = string | number | bigint | false | null | undefined | ClassValue[];

/**
 * Concatenation de classes CSS, sans dependance externe.
 * Volontairement minimaliste : pas de fusion Tailwind, l'ordre des classes
 * reste sous la responsabilite de l'appelant.
 */
export function cx(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cx(...value);
      if (nested) out.push(nested);
    } else if (typeof value === 'string') {
      out.push(value);
    }
  }
  return out.join(' ');
}
