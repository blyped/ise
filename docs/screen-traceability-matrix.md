# Matrice de tracabilite des ecrans — Competences ISE

> Genere depuis les noms de fichiers des maquettes (source de verite, cf. `docs/decisions.md` D-01).
> **199 ecrans** : ISE-001→100 (100) · SA-001→050 (50) · OPS-001→028 (28) · SYS-001→010 (10)
> · PUB-001 (1) · CMS-001→010 (10).
> Les 188 ecrans des series ISE / SA / OPS / SYS disposent chacun d'une maquette Desktop 1440 et
> d'une maquette Mobile 375 ; PUB-001 et la serie CMS viennent des maquettes de l'ADDENDUM.
>
> **Verification du 8 aout 2026** : chaque ligne ci-dessous a ete confrontee au contenu reel de
> `apps/web/src/app/`. Une ligne n'est `livre (web)` que si le ou les `page.tsx` correspondants
> existent. 179 routes sont livrees (177 `page.tsx` + `auth/callback` + `api/cms/revalidation-landing`,
> recompte du 9 aout 2026 apres les tranches ISE-024→033, ISE-073→083 et SYS-003/004/007/010).
>
> Colonnes `Tables`, `RLS`, `Mutations`, `Notifications`, `Test E2E` : renseignees au fil des tranches
> verticales. Un ecran n'est **jamais** declare `termine` avant que sa ligne soit complete et que la
> Definition of Done (MASTER PROMPT §107) soit satisfaite.
>
> Legende statut : `todo` → `en cours` → `termine`

## Convention de nommage des maquettes

```
Maquettes Web et Mobile/Competences_ISE_<ID>_<Nom>_Desktop_1440.png
Maquettes Web et Mobile/Competences_ISE_<ID>_<Nom>_Mobile_375.png
```

Les deux fichiers sont systematiquement presents ; la colonne « Maquettes » ne repete donc que le
suffixe commun.

---

## Serie ISE — Espace membre (100 ecrans)

[[ISE_TABLE_PLACEHOLDER]]

---

[[SUFFIX_PLACEHOLDER]]