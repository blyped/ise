/**
 * SUBSTITUT PROVISOIRE du fichier genere. Des que
 * `pnpm --filter @ise/db-types generate` aura ete execute, ce contenu est
 * ECRASE par la sortie du CLI Supabase : ne rien y ajouter qui doive survivre.
 *
 * Regeneration :
 *   pnpm --filter @ise/db-types generate
 *
 * Le schema compte plus de 190 tables ; ce fichier est volontairement absent du
 * depot tant que la generation n'a pas ete executee avec le CLI Supabase, afin
 * d'eviter qu'une copie manuelle diverge du schema reel (MASTER PROMPT §77).
 *
 * En attendant, `Json` et `Database` sont declares de facon permissive : le code
 * applicatif s'appuie sur les alias types de `tables.ts`, qui seront resserres
 * automatiquement des la premiere generation.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * La forme ci-dessous n'est pas decorative : `@supabase/postgrest-js` teste
 * `Database['public'] extends GenericSchema`. Si un seul membre manque — et
 * `Relationships` manquait —, le schema retombe sur `never` et TOUT appel
 * `rpc(nom, arguments)` devient invalide (« argument non assignable au type
 * undefined »). Les membres sont donc reproduits a l'identique de
 * `GenericSchema`, en restant volontairement permissifs sur le contenu.
 */
export interface GenericRelationship {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

export interface GenericTable {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
}

export interface GenericView {
  Row: Record<string, unknown>;
  Relationships: GenericRelationship[];
}

export interface GenericFunction {
  Args: Record<string, unknown>;
  Returns: unknown;
}

export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
