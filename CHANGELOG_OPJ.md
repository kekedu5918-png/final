# CHANGELOG OPJ

## Périmètre de cette mise à jour

Mise à jour juridique basée sur les fascicules fournis, avec priorité au cahier de mise à jour 07/2025-12/2025:

- `_00_cahier_de_mise_jour_de_juillet_2025_d_cembre_2025.pdf`
- `_01_f01_les_crimes_et_d_lits_contre_les_personnes_partie_1.pdf`
- `_02_f01_les_crimes_et_d_lits_contre_les_personnes_partie_2.pdf`
- `_04_f03_les_infractions_la_circulation_routi_re.pdf`
- `_18_me2_la_garde_vue_et_l_audition_libre.pdf`

## 1) Suppressions

### `js/data/flashcards.js`

- **Supprimé (logique juridique obsolète dans la fiche F02)**:
  - aggravation routière attachée par defaut a `Art. 221-6-1`.
- **Pourquoi**:
  - le cahier de mise à jour signale l'évolution des qualifications routières et la création de la branche "homicide/blessures routiers" (références 2025).

## 2) Modifications (avant/après)

### `js/data/flashcards.js`

- **F02 - Homicide involontaire**
  - **Avant**: focalisation sur `221-6` + aggravation routière directe `221-6-1`.
  - **Apres**: maintien du socle `221-6` (droit commun), avec renvoi explicite vers le régime routier `221-18 a 221-20`.

- **F04 - Viol**
  - **Avant**: "penetration ou acte bucco-genital".
  - **Apres**: ajout "bucco-anal" + mention explicite de l'absence de consentement.

- **F17 - Agression sexuelle**
  - **Avant**: axe penetration/non-penetration sans expliciter le consentement dans tous les champs.
  - **Apres**: consentement explicite dans L/A/cf/pg.

### `js/data/chapters.js`

- **L601 - Atteintes a la vie**
  - **Avant**: tableau centre sur `221-1 a 221-6`.
  - **Apres**: ajout des lignes "Homicide routier (`221-18`)" et "Blessures routières (`221-19`, `221-20`)".

- **L602/L603 - Infractions sexuelles**
  - **Avant**: viol formule "bucco-genital", agression sexuelle sans precision sur exclusion bucco-anale.
  - **Apres**: viol = penetration + bucco-genital/bucco-anal + absence de consentement; agression = sans penetration, consentement explicite, exclusion des actes bucco-anaux.

- **L1105 - Enquete apres accident de circulation**
  - **Avant**: qualifications routieres rattachees principalement a `221-6`, `222-19`, `222-20`.
  - **Apres**: distinction explicite entre droit commun et regime routier dedie (`221-18`, `221-19`, `221-20`), avec avertissement contre la transposition automatique des anciens articles.

### `js/data/questions.js`

- **nx603_1 / nx603_2 (infractions sexuelles)**
  - **Avant**: focale penetration, consentement incompletement explicite.
  - **Apres**: ajout explicite du consentement + bucco-anal dans le viol.

- **nx1105_1 / nx1105_2 (accident de circulation)**
  - **Avant**: orientation vers `221-6` et `222-19/222-20`.
  - **Apres**: bascule vers `221-18` et `221-19/221-20` comme base routiere dediee.

### `js/data/annales.js`

- **A14 - Infractions sexuelles**
  - **Avant**: correction basee sur "bucco-genital" sans mention centrale du consentement.
  - **Apres**: consentement ajoute dans mots-cles/intro/corrige + mention "bucco-genital / bucco-anal".

## 3) Ajouts

### `js/data/flashcards.js`

- **Nouvelle fiche F65**: `HOMICIDE ROUTIER` (`Art. 221-18 CP`).
- **Nouvelle fiche F66**: `BLESSURES ROUTIERES` (`Art. 221-19` et `221-20 CP`).

## 4) Notes de controle

- Mise a jour appliquee en priorite sur les zones a plus fort risque d'obsolescence signalees par le cahier 2025.
- Les sections non touchees dans cette passe restent candidates a verification fine article par article avec les fascicules thematiques complets.
