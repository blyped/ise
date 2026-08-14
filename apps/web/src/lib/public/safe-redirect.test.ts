import { describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_FALLBACK,
  inspectRedirect,
  isSafeRedirect,
  safeRedirect,
  type RedirectRefusal,
} from './safe-redirect';

/**
 * ADDENDUM §5 — Ces tests sont ecrits du point de vue de quelqu'un qui cherche
 * activement a sortir du domaine. Chaque cas porte le vecteur qu'il ferme.
 *
 * Convention : `expectRefused` verifie a la fois que la valeur est refusee,
 * que le motif journalise est le bon, et que le repli est le tableau de bord.
 * Verifier seulement le repli laisserait passer un refus « par accident ».
 */
function expectRefused(value: unknown, refusal: RedirectRefusal): void {
  const inspection = inspectRedirect(value);
  expect(inspection, `attendu refuse : ${String(value)}`).toEqual({ ok: false, refusal });
  expect(isSafeRedirect(value)).toBe(false);

  const logger = vi.fn();
  expect(safeRedirect(value, { logger })).toBe(REDIRECT_FALLBACK);
  expect(logger).toHaveBeenCalledTimes(1);
}

function expectAccepted(value: string, path: string = value): void {
  const inspection = inspectRedirect(value);
  expect(inspection, `attendu accepte : ${value}`).toEqual({ ok: true, path });
  expect(isSafeRedirect(value)).toBe(true);

  const logger = vi.fn();
  expect(safeRedirect(value, { logger })).toBe(path);
  expect(logger).not.toHaveBeenCalled();
}

describe('safeRedirect — le repli', () => {
  it('est le tableau de bord membre', () => {
    expect(REDIRECT_FALLBACK).toBe('/tableau-de-bord');
  });

  it('ne fuite rien vers l’utilisateur : la valeur de retour est identique quel que soit le motif', () => {
    const logger = vi.fn();
    const refus = [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      '',
      undefined,
    ].map((value) => safeRedirect(value, { logger }));
    expect(new Set(refus)).toEqual(new Set([REDIRECT_FALLBACK]));
  });
});

describe('safeRedirect — valeurs absentes ou mal typees', () => {
  it('refuse une valeur absente', () => {
    expectRefused(undefined, 'absent');
    expectRefused(null, 'absent');
  });

  it('refuse une chaine vide', () => {
    expectRefused('', 'vide');
  });

  it('refuse un tableau — un parametre repete dans l’URL en produit un', () => {
    // `?redirectTo=/tableau-de-bord&redirectTo=https://evil.example` : Next.js
    // renvoie alors un tableau. Prendre « le premier » serait un choix arbitraire.
    expectRefused(['/tableau-de-bord', 'https://evil.example'], 'type-invalide');
    expectRefused([], 'type-invalide');
  });

  it('refuse un objet, un nombre, un booleen', () => {
    expectRefused({ toString: () => '/tableau-de-bord' }, 'type-invalide');
    expectRefused(42, 'type-invalide');
    expectRefused(true, 'type-invalide');
  });

  it('refuse une valeur d’une longueur deraisonnable', () => {
    expectRefused(`/tableau-de-bord?x=${'a'.repeat(600)}`, 'trop-long');
  });
});

describe('safeRedirect — URL absolues et protocoles', () => {
  it('refuse une URL absolue https', () => {
    expectRefused('https://evil.example', 'protocole-externe');
    expectRefused('https://evil.example/tableau-de-bord', 'protocole-externe');
  });

  it('refuse http, ftp, file et les protocoles inventes', () => {
    expectRefused('http://evil.example', 'protocole-externe');
    expectRefused('ftp://evil.example/x', 'protocole-externe');
    expectRefused('file:///etc/passwd', 'protocole-externe');
    expectRefused('ise-app://ouvrir', 'protocole-externe');
  });

  it('refuse javascript:, quelle que soit la casse', () => {
    expectRefused('javascript:alert(1)', 'protocole-externe');
    expectRefused('JaVaScRiPt:alert(1)', 'protocole-externe');
    expectRefused('JAVASCRIPT:alert(document.cookie)', 'protocole-externe');
  });

  it('refuse data:', () => {
    expectRefused('data:text/html,<script>alert(1)</script>', 'protocole-externe');
    expectRefused(
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'protocole-externe',
    );
  });

  it('refuse vbscript: et blob:', () => {
    expectRefused('vbscript:msgbox(1)', 'protocole-externe');
    expectRefused('blob:https://evil.example/uuid', 'protocole-externe');
  });

  it('refuse une URL absolue pointant sur le domaine attendu — la fonction ne connait pas d’hote', () => {
    // Aucune exception « meme origine » : une seule regle, un chemin interne.
    expectRefused('https://competences-ise.org/tableau-de-bord', 'protocole-externe');
  });

  it('refuse les identifiants dans l’autorite', () => {
    expectRefused('https://competences-ise.org@evil.example/', 'protocole-externe');
  });
});

describe('safeRedirect — chemins protocole-relatifs', () => {
  it('refuse //evil.example', () => {
    expectRefused('//evil.example', 'chemin-protocole-relatif');
    expectRefused('//evil.example/tableau-de-bord', 'chemin-protocole-relatif');
  });

  it('refuse ///evil.example et les barres supplementaires', () => {
    expectRefused('///evil.example', 'chemin-protocole-relatif');
    expectRefused('////evil.example', 'chemin-protocole-relatif');
  });

  it('refuse //evil.example?x=/tableau-de-bord', () => {
    expectRefused('//evil.example?suite=/tableau-de-bord', 'chemin-protocole-relatif');
  });
});

describe('safeRedirect — antislash', () => {
  it('refuse \\\\/evil.example', () => {
    expectRefused('\\\\/evil.example', 'antislash');
  });

  it('refuse /\\evil.example', () => {
    // WHATWG traite l’antislash comme une barre pour les schemes speciaux :
    // `/\evil.example` est resolu en `//evil.example` par le navigateur.
    expectRefused('/\\evil.example', 'antislash');
  });

  it('refuse \\/\\/evil.example et /\\/evil.example', () => {
    expectRefused('\\/\\/evil.example', 'antislash');
    expectRefused('/\\/evil.example', 'antislash');
  });

  it('refuse un antislash n’importe ou dans la valeur', () => {
    expectRefused('/tableau-de-bord\\..\\..\\evil', 'antislash');
    expectRefused('/tableau-de-bord?x=a\\b', 'antislash');
  });
});

describe('safeRedirect — encodage pourcent', () => {
  it('refuse %2F%2Fevil.example', () => {
    expectRefused('%2F%2Fevil.example', 'chemin-non-absolu');
  });

  it('refuse /%2F%2Fevil.example : la couche decodee vaut ///evil.example', () => {
    expectRefused('/%2F%2Fevil.example', 'chemin-protocole-relatif');
  });

  it('refuse le double encodage %252F%252Fevil.example', () => {
    expectRefused('/%252F%252Fevil.example', 'chemin-protocole-relatif');
  });

  it('refuse le triple encodage', () => {
    expectRefused('/%25252F%25252Fevil.example', 'chemin-protocole-relatif');
  });

  it('refuse un antislash encode', () => {
    expectRefused('/%5Cevil.example', 'antislash');
    expectRefused('/%255Cevil.example', 'antislash');
  });

  it('refuse un protocole encode', () => {
    expectRefused('%6A%61%76%61%73%63%72%69%70%74%3Aalert(1)', 'chemin-non-absolu');
    expectRefused('/%2E%2E/%2E%2E/evil', 'traversee');
  });

  it('refuse une sequence pourcent malformee', () => {
    expectRefused('/tableau-de-bord%', 'encodage-invalide');
    expectRefused('/tableau-de-bord%zz', 'encodage-invalide');
    expectRefused('/tableau-de-bord%E0%A4%A', 'encodage-invalide');
  });

  it('refuse un empilement d’encodages au-dela de la limite', () => {
    // Cinq couches ou plus : aucune route legitime n’en porte autant.
    expectRefused('/tableau-de-bord%2525252525252F', 'encodage-imbrique');
  });

  it('accepte un pourcent litteral legitime dans la requete', () => {
    expectAccepted('/rechercher/resultats?q=100%25');
  });
});

describe('safeRedirect — caracteres de controle et injection d’en-tete', () => {
  it('refuse une tabulation, que les navigateurs retirent des URL', () => {
    expectRefused('/\t/evil.example', 'caractere-interdit');
    expectRefused('/%09/evil.example', 'caractere-interdit');
  });

  it('refuse un saut de ligne et un retour chariot encodes — injection dans Location', () => {
    expectRefused('/tableau-de-bord%0d%0aSet-Cookie:%20a=b', 'caractere-interdit');
    expectRefused('/tableau-de-bord\r\nSet-Cookie: a=b', 'caractere-interdit');
  });

  it('refuse un octet nul', () => {
    expectRefused('/tableau-de-bord%00.html', 'caractere-interdit');
    expectRefused('/tableau-de-bord ', 'caractere-interdit');
  });

  it('refuse un espace de tete ou de queue plutot que de le rogner', () => {
    expectRefused(' /tableau-de-bord', 'caractere-interdit');
    expectRefused('/tableau-de-bord ', 'caractere-interdit');
    expectRefused('   ', 'caractere-interdit');
  });

  it('refuse un caractere de controle C1 et DEL', () => {
    expectRefused('/tableau-de-bord', 'caractere-interdit');
    expectRefused('/tableau-de-bord', 'caractere-interdit');
    expectRefused('/tableau-de-bord%7f', 'caractere-interdit');
  });
});

describe('safeRedirect — traversee de repertoires', () => {
  it('refuse un segment .. explicite', () => {
    expectRefused('/tableau-de-bord/../../evil', 'traversee');
    expectRefused('/../evil', 'traversee');
    expectRefused('/..', 'traversee');
  });

  it('refuse une traversee encodee', () => {
    expectRefused('/tableau-de-bord/%2e%2e/%2e%2e/evil', 'traversee');
  });

  it('accepte un point qui n’est pas un segment', () => {
    expectAccepted('/profil/jean.dupont');
  });
});

describe('safeRedirect — boucle d’authentification', () => {
  it('refuse /connexion', () => {
    expectRefused('/connexion', 'boucle-authentification');
  });

  it('refuse /connexion avec son propre redirectTo', () => {
    expectRefused('/connexion?redirectTo=%2Fconnexion', 'boucle-authentification');
  });

  it('refuse les autres ecrans d’authentification', () => {
    expectRefused('/creer-compte', 'boucle-authentification');
    expectRefused('/mot-de-passe-oublie', 'boucle-authentification');
    expectRefused('/reinitialiser-mot-de-passe?token=x', 'boucle-authentification');
    expectRefused('/deconnexion', 'boucle-authentification');
    expectRefused('/auth/callback?code=x', 'boucle-authentification');
    expectRefused('/session-expiree', 'boucle-authentification');
  });

  it('refuse une variation de casse de /connexion', () => {
    expectRefused('/CONNEXION', 'boucle-authentification');
    expectRefused('/Connexion/', 'boucle-authentification');
  });

  it('refuse un descendant d’un ecran d’authentification', () => {
    expectRefused('/connexion/quelque-chose', 'boucle-authentification');
  });
});

describe('safeRedirect — liste blanche de routes', () => {
  it('refuse la racine publique : ce n’est pas une destination d’apres-connexion', () => {
    expectRefused('/', 'racine-publique');
    expectRefused('//', 'chemin-protocole-relatif');
    expectRefused('/?x=1', 'racine-publique');
  });

  it('refuse un chemin interne inconnu', () => {
    // `/administration` a rejoint MEMBER_ROUTE_PREFIXES avec le back-office
    // Superadmin : c'est desormais une cible legitime d'apres-connexion.
    expectRefused('/exploitation', 'route-non-autorisee');
    expectRefused('/api/cms/revalidation-landing', 'route-non-autorisee');
    expectRefused('/.well-known/x', 'route-non-autorisee');
  });

  it('refuse /messages : la messagerie ISE<->ISE a ete retiree (C-08)', () => {
    // La route est sortie de MEMBER_ROUTE_PREFIXES avec le module. Une cible
    // heritee d'un ancien lien retombe sur le tableau de bord.
    expectRefused('/messages', 'route-non-autorisee');
    expectRefused('/messages/0f6c8f5a-3c3a-4f21-9b8b-1f3a2d4e5c6d', 'route-non-autorisee');
  });

  it('refuse /https:/evil.example — chemin interne en apparence, hors liste blanche', () => {
    // Cas classique : la valeur passe les controles lexicaux, seule la liste
    // blanche la refuse. C’est la raison d’etre de la troisieme porte.
    expectRefused('/https:/evil.example', 'route-non-autorisee');
  });

  it('refuse un prefixe qui ressemble a une route autorisee sans en etre une', () => {
    expectRefused('/tableau-de-bord-externe', 'route-non-autorisee');
    expectRefused('/messagerie', 'route-non-autorisee');
  });

  it('refuse un chemin relatif sans barre initiale', () => {
    expectRefused('tableau-de-bord', 'chemin-non-absolu');
    expectRefused('./tableau-de-bord', 'chemin-non-absolu');
    expectRefused('evil.example/tableau-de-bord', 'chemin-non-absolu');
    expectRefused('evil.example:8080/x', 'protocole-externe');
  });
});

describe('safeRedirect — cibles acceptees', () => {
  it('accepte le tableau de bord', () => {
    expectAccepted('/tableau-de-bord');
  });

  it('accepte les routes membres de chaque module', () => {
    expectAccepted('/mon-profil');
    expectAccepted('/rechercher');
    expectAccepted('/reseau/relations');
    expectAccepted('/appels');
    expectAccepted('/opportunites');
    expectAccepted('/candidatures');
    expectAccepted('/communautes');
    expectAccepted('/notifications');
    expectAccepted('/parametres/confidentialite');
    expectAccepted('/aide');
    expectAccepted('/bienvenue/promotion');
    expectAccepted('/reclamer-mon-profil');
  });

  it('accepte une ressource identifiee', () => {
    expectAccepted('/opportunites/0f6c8f5a-3c3a-4f21-9b8b-1f3a2d4e5c6d');
    expectAccepted('/profil/0f6c8f5a-3c3a-4f21-9b8b-1f3a2d4e5c6d');
    expectAccepted('/appels/0f6c8f5a-3c3a-4f21-9b8b-1f3a2d4e5c6d/repondre');
  });

  it('conserve la requete et le fragment', () => {
    expectAccepted('/rechercher/resultats?competence=12&pays=CI');
    expectAccepted('/mon-profil#experiences');
    expectAccepted('/rechercher/resultats?q=a#resultat-3');
  });

  it('normalise la barre finale', () => {
    expectAccepted('/tableau-de-bord/', '/tableau-de-bord');
    expectAccepted('/notifications///', '/notifications');
  });

  it('conserve un identifiant encode dans le chemin', () => {
    expectAccepted('/profil/a%20b');
  });

  it('refuse une URL externe portee par la requete — choix conservateur assume', () => {
    // La cible resterait interne, mais une couche decodee contient `://`.
    // Aucune route membre n’a besoin de transporter une URL externe dans un
    // `redirectTo` : le refus coûte moins cher que l’exception.
    expectRefused('/aide?url=https%3A%2F%2Fexemple.org', 'protocole-externe');
  });
});

describe('safeRedirect — journalisation', () => {
  it('journalise le motif, la source et un apercu neutralise', () => {
    const logger = vi.fn();
    safeRedirect('/tableau-de-bord\r\nSet-Cookie: a=b', {
      logger,
      source: 'ISE-001',
      correlationId: 'abc',
    });

    expect(logger).toHaveBeenCalledTimes(1);
    const [message, details] = logger.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toContain('redirectTo');
    expect(details['motif']).toBe('caractere-interdit');
    expect(details['source']).toBe('ISE-001');
    expect(details['correlationId']).toBe('abc');
    expect(details['repli']).toBe(REDIRECT_FALLBACK);
    // L’apercu ne doit pas pouvoir fabriquer une fausse ligne de journal.
    expect(details['apercu']).toBe('/tableau-de-bord\\x0d\\x0aSet-Cookie: a=b');
  });

  it('borne l’apercu d’une valeur trop longue', () => {
    const logger = vi.fn();
    safeRedirect(`/x${'a'.repeat(1000)}`, { logger });
    const [, details] = logger.mock.calls[0] as [string, Record<string, unknown>];
    expect(String(details['apercu']).length).toBeLessThanOrEqual(120);
  });

  it('n’ecrit rien quand la cible est acceptee', () => {
    const logger = vi.fn();
    safeRedirect('/tableau-de-bord', { logger });
    expect(logger).not.toHaveBeenCalled();
  });

  it('utilise console.warn par defaut', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    safeRedirect('https://evil.example');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('safeRedirect — proprietes generales', () => {
  const vecteurs = [
    'https://evil.example',
    'http://evil.example',
    '//evil.example',
    '///evil.example',
    '\\\\/evil.example',
    '/\\evil.example',
    '/\\/evil.example',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '%2F%2Fevil.example',
    '/%2F%2Fevil.example',
    '/%252F%252Fevil.example',
    '/%5Cevil.example',
    '/\t/evil.example',
    '/tableau-de-bord%0d%0aSet-Cookie:%20a=b',
    '/tableau-de-bord%00',
    '/../../evil',
    '/connexion',
    '/connexion?redirectTo=/connexion',
    '',
    ' ',
    '/',
    '/administration',
    'tableau-de-bord',
    'https://competences-ise.org@evil.example/',
  ];

  it('ne renvoie jamais autre chose qu’un chemin interne autorise', () => {
    const logger = vi.fn();
    for (const vecteur of vecteurs) {
      const resultat = safeRedirect(vecteur, { logger });
      expect(resultat.startsWith('/'), vecteur).toBe(true);
      expect(resultat.startsWith('//'), vecteur).toBe(false);
      expect(resultat.includes('evil.example'), vecteur).toBe(false);
      expect(resultat.includes(':'), vecteur).toBe(false);
    }
  });

  it('est idempotente : le resultat d’un appel est une entree valide', () => {
    for (const vecteur of [...vecteurs, '/mon-profil', '/notifications?x=1']) {
      const une = safeRedirect(vecteur, { logger: vi.fn() });
      const deux = safeRedirect(une, { logger: vi.fn() });
      expect(deux, vecteur).toBe(une);
    }
  });

  it('ne leve jamais, quelle que soit l’entree', () => {
    const entrees: unknown[] = [
      undefined,
      null,
      NaN,
      Symbol('x'),
      () => '/tableau-de-bord',
      new Date(),
      { redirectTo: '/tableau-de-bord' },
      '\uD800',
      '/%ED%A0%80',
    ];
    for (const entree of entrees) {
      expect(() => safeRedirect(entree, { logger: vi.fn() })).not.toThrow();
    }
  });
});
