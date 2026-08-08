import { Avatar } from '@ise/ui-web';
import { frNetwork } from '@/i18n/network';

export interface PathNode {
  name: string;
  /** Ligne secondaire : promotion, role dans le chemin… */
  caption?: string | undefined;
}

export interface PathEdge {
  label: string;
  /** `true` quand le lien est CONSTATE, `false` quand il reste a faire. */
  established: boolean;
}

/**
 * Chemin d'introduction : `Vous -> intermediaire -> personne visée`.
 *
 * D-51 : il n'y a jamais plus de trois nœuds, parce que le produit
 * n'explore jamais le graphe au-dela d'une relation directe. Ce composant
 * ne sait donc pas dessiner un chemin plus long, et c'est voulu.
 *
 * ACCESSIBILITE : le graphe est une LISTE ORDONNEE. Les connecteurs et
 * leurs libelles sont dans le flux, pas en decoration CSS : un lecteur
 * d'ecran restitue « Vous, relation directe, Fatou, à transmettre,
 * Koffi ». Aucune information n'est portee par la seule couleur (D-90) :
 * un lien non encore constate est en pointilles ET porte son libelle.
 *
 * RESPONSIVE : colonne verticale sous `md` (chaque etape sur sa ligne,
 * lisible a 375 px), ligne horizontale a partir de `md`.
 */
export function IntroductionPathGraph({
  nodes,
  edges,
  caption,
}: {
  nodes: readonly [PathNode, PathNode, PathNode];
  edges: readonly [PathEdge, PathEdge];
  caption?: string | undefined;
}) {
  return (
    <div className="border-border rounded-lg border bg-[#F8FAFC] p-5">
      <ol className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-2">
        {nodes.map((node, index) => (
          <li key={`${node.name}-${index}`} className="contents">
            <div className="flex items-center gap-3 md:flex-col md:gap-2 md:text-center">
              <Avatar name={node.name} size={40} decorative />
              <span className="min-w-0">
                <span className="text-body-sm text-text-primary block font-semibold">
                  {node.name}
                </span>
                {node.caption !== undefined && node.caption.length > 0 ? (
                  <span className="text-caption text-text-muted block">{node.caption}</span>
                ) : null}
              </span>
            </div>

            {index < edges.length ? (
              <span className="flex items-center gap-2 pl-5 md:flex-1 md:flex-col md:gap-1 md:pl-0">
                <span
                  aria-hidden="true"
                  className={
                    edges[index]!.established
                      ? 'border-success block h-6 w-px border-l-2 border-solid md:h-px md:w-full md:border-l-0 md:border-t-2'
                      : 'block h-6 w-px border-l-2 border-dashed border-[#CBD5E1] md:h-px md:w-full md:border-l-0 md:border-t-2'
                  }
                />
                <span className="text-caption text-text-muted">{edges[index]!.label}</span>
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {caption !== undefined && caption.length > 0 ? (
        <p className="text-caption text-text-muted mt-4">{caption}</p>
      ) : null}
    </div>
  );
}

/** Nœud « moi », libelle identique partout. */
export const SELF_NODE: PathNode = { name: frNetwork.paths.you };
