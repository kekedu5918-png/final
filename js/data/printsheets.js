const PRINTSHEETS=[
  {id:'ps1',title:'Classification tripartite & Tentative',emoji:'📊',sub:'Art. 111-1 CP · Art. 121-5 CP'},
  {id:'ps2',title:'GAV — Tous régimes comparés',emoji:'🔒',sub:'Art. 63, 706-88, 706-88-1 CPP'},
  {id:'ps3',title:'Cadres d\'enquête & Perquisitions',emoji:'🔍',sub:'Art. 53, 75, 151, 56, 76 CPP'},
  {id:'ps4',title:'Infractions principales — Méthode LAME',emoji:'⚖️',sub:'Homicide · Vol · Viol · Stups · Escroquerie'},
  {id:'ps5',title:'Mandats, CJ, ARSE, Détention provisoire',emoji:'⛓️',sub:'Art. 122-143 CPP'},
  {id:'pv1',title:'Canevas PV — Plainte & Témoignage',emoji:'📝',sub:'Art. 53 et s. CPP · Art. 10-2 CPP'},
  {id:'pv2',title:'Canevas PV — Interpellation + GAV',emoji:'🚨',sub:'Art. 63-1 à 63-4-3 CPP · Loi 22/04/2024'},
  {id:'pv3',title:'Canevas PV — Perquisition & Fouilles',emoji:'🔍',sub:'Art. 56/76 CPP · SDIACSS'},
  {id:'art1',title:'Ligne du Temps — ALPHA (20 actes FD)',emoji:'⏱️',sub:'Vol · Flagrant Délit complet'},
  {id:'lame',title:'Méthode LAME — Fiche Mémo Infraction',emoji:'⚖️',sub:'Légal · Actuel · Moral · Enrôlement'},
  {id:'bloc1',title:'Libertés Publiques & Acteurs PJ',emoji:'🏛️',sub:'DDHC 1789 · Art. 40 CPP · Acteurs PJ'},
  {id:'bloc2',title:'Fichiers Police & Réquisitions',emoji:'🗃️',sub:'TAJ · FNAEG · FAED · Art. 60/77-1 CPP'},
];
const PRINTCONTENT={
ps1:`<h1>📊 Classification tripartite & Tentative</h1>
<h2>Tripartition des infractions (Art. 111-1 CP)</h2>
<div class="table-scroll"><table><tr><th>Nature</th><th>Peine</th><th>Juridiction</th><th>Prescription AP</th></tr>
<tr><td>CRIME</td><td>Réclusion criminelle / Perpétuité</td><td>Cour d'Assises</td><td>20 ans</td></tr>
<tr><td>DÉLIT</td><td>Emprisonnement + amende</td><td>Tribunal Correctionnel</td><td>6 ans</td></tr>
<tr><td>CONTRAVENTION</td><td>Amende ≤ 1 500 €</td><td>Tribunal de Police</td><td>1 an</td></tr></table></div>
<h2>Tentative (Art. 121-5 CP)</h2>
<p>Conditions : <strong>commencement d'exécution</strong> + <strong>désistement involontaire</strong></p>
<p>Crime → toujours punissable. Délit → si texte exprès. Contravention → JAMAIS.</p>
<div class="piege-box">⚠️ Piège : La tentative de contravention N'EST PAS punissable. La tentative d'un délit doit être expressément prévue par le texte.</div>
<h2>Récidive légale (Art. 132-8 CP)</h2>
<div class="table-scroll"><table><tr><th>Type</th><th>Délai</th><th>Effet</th></tr>
<tr><td>Crime / Crime</td><td>Perpétuel</td><td>Doublement de la peine max</td></tr>
<tr><td>Délit / Délit assimilé</td><td>5 ans</td><td>Doublement de la peine max</td></tr>
<tr><td>Contravention 5e classe</td><td>1 an</td><td>Alourdissement</td></tr></table></div>`,

ps2:`<h1>🔒 GAV — Tous régimes</h1>
<div class="table-scroll"><table><tr><th>Régime</th><th>Initiale</th><th>Max total</th><th>Prolongation</th></tr>
<tr><td>Droit commun (art. 63)</td><td>24h</td><td>48h</td><td>PR — écrit + motivé</td></tr>
<tr><td>Criminalité organisée (706-88)</td><td>24h</td><td>96h</td><td>PR puis JLD (>48h)</td></tr>
<tr><td>Terrorisme (706-88-1)</td><td>24h</td><td>144h</td><td>PR puis JLD (>48h)</td></tr>
<tr><td>Mineur 13-16 ans</td><td>24h</td><td>48h max</td><td>PR (ou JLD si CO)</td></tr></table></div>
<h2>Droits notifiés IMMÉDIATEMENT (Art. 63-1 CPP)</h2>
<p>Droit au silence · Avocat SANS délai (loi 22/04/2024) · Examen médical · Aviser un proche · Interprète</p>
<div class="piege-box">⚠️ Pièges : (1) Heure de GAV = heure d'APPRÉHENSION, pas d'arrivée au commissariat. (2) Délai de carence avocat SUPPRIMÉ depuis le 22/04/2024. (3) Avis PR = IMMÉDIAT. (4) Mineur <16 ans : examen médical OBLIGATOIRE ET IMMÉDIAT.</div>`,

ps3:`<h1>🔍 Cadres d'enquête & Perquisitions</h1>
<h2>Les 5 cadres d'enquête</h2>
<div class="table-scroll"><table><tr><th>Cadre</th><th>Article</th><th>Durée</th><th>Pouvoirs</th></tr>
<tr><td>Flagrance</td><td>Art. 53 CPP</td><td>8j + 8j (JLD)</td><td>Contrainte immédiate</td></tr>
<tr><td>Préliminaire</td><td>Art. 75 CPP</td><td>2 ans + 1 an</td><td>Consentement ou JLD</td></tr>
<tr><td>Commission rogatoire</td><td>Art. 151 CPP</td><td>Limitée par CR</td><td>Identiques à flagrance</td></tr>
<tr><td>Art. 74 (mort suspecte)</td><td>Art. 74 CPP</td><td>—</td><td>Avant qualification pénale</td></tr>
<tr><td>Art. 74-1 (disparition)</td><td>Art. 74-1 CPP</td><td>—</td><td>3 critères cumulatifs</td></tr></table></div>
<h2>Règles de perquisition</h2>
<div class="table-scroll"><table><tr><th>Cadre</th><th>Accord requis</th><th>Horaires</th><th>Particularités</th></tr>
<tr><td>Flagrance</td><td>NON</td><td>24h/24</td><td>Art. 56 CPP</td></tr>
<tr><td>Préliminaire</td><td>OUI (écrit) ou JLD</td><td>6h–21h</td><td>Art. 76 CPP</td></tr>
<tr><td>CR</td><td>NON</td><td>24h/24</td><td>Art. 94-96 CPP</td></tr></table></div>
<p><strong>Lieux protégés :</strong> Avocat → bâtonnier OBLIGATOIRE | Médecin → président ordre | Presse → magistrat</p>`,

ps4:`<h1>⚖️ Infractions principales — Méthode LAME</h1>
<div class="table-scroll"><table><tr><th>Infraction</th><th>Article</th><th>Qual.</th><th>Peine de base</th><th>Élément moral</th></tr>
<tr><td>MEURTRE</td><td>221-1 CP</td><td>Crime</td><td>30 ans RC</td><td>Intention de tuer (animus necandi)</td></tr>
<tr><td>ASSASSINAT</td><td>221-3 CP</td><td>Crime</td><td>Perpétuité</td><td>Préméditation + intention de tuer</td></tr>
<tr><td>VIOL</td><td>222-23 CP</td><td>Crime</td><td>15 ans RC</td><td>Intentionnel, sans consentement</td></tr>
<tr><td>VOL SIMPLE</td><td>311-1 CP</td><td>Délit</td><td>3 ans / 45k€</td><td>Intention de se comporter en propriétaire</td></tr>
<tr><td>VOL BANDE ORG.</td><td>311-9 CP</td><td>Crime</td><td>15 ans RC</td><td>Intentionnel + organisation</td></tr>
<tr><td>ESCROQUERIE</td><td>313-1 CP</td><td>Délit</td><td>5 ans / 375k€</td><td>Tromperie → remise</td></tr>
<tr><td>ABUS DE CONFIANCE</td><td>314-1 CP</td><td>Délit</td><td>3 ans / 375k€</td><td>Remise préalable licite + détournement</td></tr>
<tr><td>RECEL</td><td>321-1 CP</td><td>Délit</td><td>5 ans / 375k€</td><td>Connaissance origine frauduleuse</td></tr>
<tr><td>USAGE STUPS</td><td>L3421-1 CSP</td><td>Délit</td><td>1 an / 3 750€</td><td>Intentionnel</td></tr>
<tr><td>BLANCHIMENT</td><td>324-1 CP</td><td>Délit</td><td>5 ans / 375k€</td><td>Connaissance origine criminelle</td></tr></table></div>`,

ps5:`<h1>⛓️ Mandats, CJ, ARSE, Détention Provisoire</h1>
<h2>Les 4 mandats + mandat de recherche</h2>
<div class="table-scroll"><table><tr><th>Mandat</th><th>Article</th><th>Auteur</th><th>Effet</th></tr>
<tr><td>Comparution</td><td>122 al.1 CPP</td><td>JI</td><td>Se présenter volontairement</td></tr>
<tr><td>Amener</td><td>122 al.2 CPP</td><td>JI</td><td>Conduire de force — pas d'incarcération</td></tr>
<tr><td>Dépôt</td><td>122 al.3 CPP</td><td>JI</td><td>Incarcération immédiate</td></tr>
<tr><td>Arrêt</td><td>131 CPP</td><td>JI</td><td>Fugitifs/étranger — arrestation + prison</td></tr>
<tr><td>Recherche</td><td>122-4 CPP</td><td>PR</td><td>Interpellation — délits ≥3 ans — 1 an renouv.</td></tr></table></div>
<h2>Tableau comparatif CJ / ARSE / DP</h2>
<div class="table-scroll"><table><tr><th>Mesure</th><th>Article</th><th>Seuil peine</th><th>Décideur</th><th>Durée</th></tr>
<tr><td>Contrôle Judiciaire</td><td>138 CPP</td><td>Tout emprisonnement</td><td>JLD</td><td>Sans limite légale</td></tr>
<tr><td>ARSE</td><td>142-5 CPP</td><td>≥ 2 ans</td><td>JLD</td><td>Même régime DP</td></tr>
<tr><td>Détention Provisoire</td><td>143-1 CPP</td><td>≥ 3 ans</td><td>JLD</td><td>4 mois → 2 ans max (correctionnel)</td></tr></table></div>
<div class="piege-box">⚠️ Piège fondamental : Le JI seul NE PEUT JAMAIS décider la DP. C'est TOUJOURS le JLD, saisi par ordonnance du JI avec réquisitions du PR.</div>`,
pv1:`<h1>📝 Canevas PV — Plainte &amp; Témoignage</h1>
<h2>SAISINE — PLAINTE (Art. 53 et s. CPP · Art. 10-2 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Structure du cartouche plainte</div>
<div class="table-scroll"><table>
<tr><th>Rubrique</th><th>Contenu obligatoire</th></tr>
<tr><td><strong>En-tête</strong></td><td>Étant au service — date, heure, lieu de rédaction</td></tr>
<tr><td><strong>Saisine</strong></td><td>Constatons que se présente NOM Prénom victime du fait de [infraction]</td></tr>
<tr><td><strong>Cadre juridique</strong></td><td>Agissant en flagrant délit — Vu les articles 53 et s. CPP</td></tr>
<tr><td><strong>Droits Art. 10-2</strong></td><td>Information des droits de la victime — Formulaire remis</td></tr>
<tr><td><strong>Identité victime</strong></td><td>NOM, prénom, DOB, lieu naissance, adresse, nationalité, profession</td></tr>
<tr><td><strong>Déclaration des faits</strong></td><td>Description précise, préjudice, capacité à reconnaître l'auteur</td></tr>
<tr><td><strong>Avis Parquet</strong></td><td>Avisons immédiatement M. le Procureur de la République (Art. 40 CPP)</td></tr>
<tr><td><strong>Clôture</strong></td><td>Plainte contre X ou personne dénommée — Récépissé remis de droit</td></tr>
<tr><td><strong>Signature</strong></td><td>Après lecture, NOM Prénom signe avec nous le présent PV</td></tr>
</table></div></div>
<h2>SAISINE — TÉMOIGNAGE (Art. 53 et s. CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Élément</th><th>Formule type</th></tr>
<tr><td>Saisine</td><td>Sommes requis par [identité] qui déclare avoir été témoin de [fait]</td></tr>
<tr><td>Cadre</td><td>Agissant en flagrant délit — Vu les articles 53 et s. CPP</td></tr>
<tr><td>Identité</td><td>L'invitons à nous décliner son identité : NOM Prénom, DOB, adresse</td></tr>
<tr><td>Q/R</td><td>QUESTION : … / RÉPONSE : … (autant que nécessaire)</td></tr>
<tr><td>Signature</td><td>Après lecture, signe avec nous le présent PV</td></tr>
</table></div>
<h2>SAISINE — TRANSPORT / CONSTATATIONS</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule type</th></tr>
<tr><td>Départ</td><td>Étant au service — Sommes requis par [mode saisine] du fait de [infraction]</td></tr>
<tr><td>SDPTS</td><td>Sollicitons le SDPTS aux fins de relevé de traces ou indices</td></tr>
<tr><td>Transport</td><td>Assisté des GP … nous transportons à [adresse] — Où étant à [heure]</td></tr>
<tr><td>Constatations</td><td><strong>En présence constante et effective du SDPTS</strong> — constatons extérieur, progression, éléments</td></tr>
<tr><td>Résultat PTS</td><td>Le SDPTS indique n'avoir relevé aucune trace / ou description des traces</td></tr>
<tr><td>Clôture</td><td>Dont PV que nos assistants signent avec nous</td></tr>
</table></div>
<div class="ok"><strong>✓ Avis Parquet obligatoire :</strong> Art. 40 CPP — dès la constatation d'un crime ou délit. Le récépissé est de droit à la demande de la victime (Art. 10-2 CPP).</div>
<div class="piege"><strong>⚠️ Pièges :</strong> Toujours mentionner la <u>présence constante et effective</u> du SDPTS. L'heure de GAV = heure d'appréhension, jamais l'heure d'arrivée au service.</div>`,
pv2:`<h1>🚨 Canevas PV — Interpellation &amp; Garde à Vue</h1>
<h2>INTERPELLATION (Art. 53 et s. CPP · Art. 803 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule obligatoire</th><th>Article</th></tr>
<tr><td>Constat</td><td>Constatons [fait + signalement] — Agissant en flagrant délit</td><td>Art. 53 CPP</td></tr>
<tr><td>Interpellation</td><td>Interpellons l'individu à [heure] au [lieu]</td><td>Art. 53 CPP</td></tr>
<tr><td>Menottage</td><td>Conformément à l'Art. 803 CPP — Menottons car [justification : fuite/danger/résistance]</td><td>Art. 803 CPP</td></tr>
<tr><td>Palpation</td><td>Palpé par mesure de sécurité par le GP : positif [objet] / négatif</td><td>Mesure sécurité</td></tr>
<tr><td>Identité</td><td>L'invitons à nous décliner son identité : il nous déclare se nommer…</td><td>—</td></tr>
<tr><td>Notification verbale GAV</td><td>L'informons qu'il est placé en GAV à compter de [heure] d'interpellation pour [qualification]</td><td>Art. 63-1 CPP</td></tr>
<tr><td>Droits verbaux</td><td>L'informons immédiatement de ses droits Art. 63-1 à 63-4-3 — PV séparé à suivre</td><td>Art. 63-1 à 63-4-3</td></tr>
</table></div>
<h2>NOTIFICATION PLACEMENT EN GAV — MAJEUR (Art. 63-1 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Éléments obligatoires du cartouche GAV</div>
<ul>
<li><strong>À compter du</strong> [date] à [heure] de l'interpellation</li>
<li><strong>Pour les faits</strong> de [qualification] commis le [date] à [ville]</li>
<li><strong>Motif du [1° à 6°] de l'Art. 62-2 CPP</strong> — la GAV est l'unique moyen de…</li>
<li><strong>Durée maximale :</strong> 24H + 24H possible sur accord du Parquet</li>
<li>Notification droits : silence, interprète, avis proche/avocat/autorités consulaires, médecin, pièces, observations</li>
<li>Remise du <strong>formulaire de déclaration des droits</strong></li>
</ul></div>
<h2>LES 6 OBJECTIFS DE LA GAV (Art. 62-2 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>N°</th><th>Objectif — La GAV doit être l'UNIQUE moyen de…</th></tr>
<tr><td>1°</td><td>Permettre les investigations impliquant la présence/participation de la personne</td></tr>
<tr><td>2°</td><td>Garantir la présentation devant le Procureur de la République</td></tr>
<tr><td>3°</td><td>Empêcher la modification des preuves ou indices matériels</td></tr>
<tr><td>4°</td><td>Empêcher les pressions sur témoins, victimes, proches</td></tr>
<tr><td>5°</td><td>Empêcher la concertation avec coauteurs ou complices</td></tr>
<tr><td>6°</td><td>Garantir la mise en œuvre des mesures pour faire cesser le crime/délit</td></tr>
</table></div>
<h2>DROITS EN GAV (Art. 63-1 à 63-4-3 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Droit</th><th>Article</th><th>Délai / Note</th></tr>
<tr><td>Droit au silence</td><td>Art. 63-1</td><td>Immédiat — pas d'obligation de répondre</td></tr>
<tr><td>Interprète gratuit</td><td>Art. 63-1</td><td>Immédiat si ne comprend pas le français</td></tr>
<tr><td>Avis proche/employeur</td><td>Art. 63-2</td><td>Dès la 1ère heure — sans délai</td></tr>
<tr><td>Avocat + entretien 30 min</td><td>Art. 63-3-1</td><td><strong>Sans délai de carence — Loi 22/04/2024</strong></td></tr>
<tr><td>Médecin</td><td>Art. 63-3</td><td>À tout moment</td></tr>
<tr><td>Consulter pièces</td><td>Art. 63-4-1</td><td>À tout moment</td></tr>
<tr><td>Présenter observations</td><td>Art. 63-4-2</td><td>Au magistrat</td></tr>
</table></div>
<h2>DURÉES DE GAV</h2>
<div class="table-scroll"><table>
<tr><th>Profil</th><th>Initiale</th><th>Prolongation</th><th>CDO (Art. 706-88)</th></tr>
<tr><td>Majeur droit commun</td><td>24H</td><td>+24H (accord Parquet)</td><td>+48H +48H</td></tr>
<tr><td>Mineur 13-16 ans</td><td>24H</td><td>+24H séparé majeurs</td><td>Régime CJPM</td></tr>
<tr><td>Mineur 16-18 ans</td><td>24H</td><td>+24H séparé majeurs</td><td>Régime CJPM</td></tr>
<tr><td>Retenue 10-13 ans</td><td>12H</td><td>—</td><td>Infraction ≥ 5 ans emp.</td></tr>
</table></div>
<div class="warn"><strong>⚡ Loi 22 avril 2024 :</strong> Délai de carence avocat <strong>supprimé</strong>. L'avocat intervient dès le début de la GAV.</div>
<div class="piege"><strong>⚠️ Pièges :</strong> (1) Seul l'OPJ peut placer en GAV. (2) La GAV doit être l'<u>unique</u> moyen. (3) Heure GAV = heure interpellation, pas d'arrivée au service.</div>`,
pv3:`<h1>🔍 Canevas PV — Perquisition &amp; Fouilles</h1>
<h2>PERQUISITION — FLAGRANT DÉLIT (Art. 56 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule type</th></tr>
<tr><td>Transport</td><td>Muni des clés extraites de sa fouille — En compagnie du nommé, nous transportons à [adresse]</td></tr>
<tr><td>Constat extérieur</td><td>Constatons qu'il s'agit de [description extérieure des lieux]</td></tr>
<tr><td>Entrée</td><td>À [heure], à l'aide des clés, pénétrons dans les lieux</td></tr>
<tr><td>Perquisition</td><td><strong>En la présence constante et effective</strong> du nommé — procédons à minutieuse perquisition — Description des pièces</td></tr>
<tr><td>Découverte</td><td>Dans [localisation], sous/sur [meuble], découvrons [élément] — Description précise</td></tr>
<tr><td>Interrogation</td><td>Interpellé sur l'origine, le nommé nous déclare :</td></tr>
<tr><td>Saisie</td><td>Saisissons et plaçons sous <strong>scellé n° UN</strong> : [description complète]</td></tr>
<tr><td>Fin</td><td>Perquisition terminée à [heure] sans incident — aucun autre élément</td></tr>
<tr><td>Clôture</td><td>Refermons les lieux — Clés replaçons dans les effets du nommé</td></tr>
<tr><td>Signature</td><td>Après lecture, le nommé signe avec nous et nos assistants ainsi que la fiche de scellé</td></tr>
</table></div>
<div class="warn"><strong>⚠️ Heures légales :</strong> 6H – 21H en tout lieu. Sauf crime ou FD chez la personne interpellée = 24H/24.</div>
<h2>PERQUISITION — ENQUÊTE PRÉLIMINAIRE (Art. 76 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Différence clé avec FD</div>
<ul>
<li>Nécessite l'<strong>assentiment exprès et manuscrit</strong> de la personne</li>
<li>En cas de refus ET crime ou délit puni d'au moins 5 ans d'emprisonnement : requête Parquet → autorisation JLD (écrite et motivée) — Art. 76 al. 4 CPP</li>
<li>Mêmes heures légales : 6H – 21H</li>
</ul></div>
<h2>FOUILLE INTÉGRALE (Art. 53 et s. CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule</th></tr>
<tr><td>Nécessité</td><td>Susceptible de détenir [élément] non détectable par palpation</td></tr>
<tr><td>Exécution</td><td>Procédons à fouille intégrale sur la personne de NOM Prénom</td></tr>
<tr><td>Découverte</td><td>Dans [endroit], découvrons [élément] — description précise</td></tr>
<tr><td>Saisie</td><td>Saisissons et plaçons sous scellé n° [numéro]</td></tr>
<tr><td>Fin</td><td>Fouille terminée, ne nous permet de découvrir aucun autre élément</td></tr>
</table></div>
<h2>FOUILLE VÉHICULE (Art. 53 et s. CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Étape</th><th>Formule</th></tr>
<tr><td>Constat</td><td>Constatons présence du véhicule [marque, modèle, immat.], stationné</td></tr>
<tr><td>Ouverture</td><td>À l'aide des clés : portières, capot, coffre</td></tr>
<tr><td>Fouille</td><td><strong>En présence constante et effective</strong> du nommé — minutieuse fouille</td></tr>
<tr><td>Saisie</td><td>Saisissons et plaçons sous scellé n° [numéro]</td></tr>
<tr><td>Clôture</td><td>Refermons le véhicule — clés replacées dans effets du nommé</td></tr>
</table></div>
<h2>MÉTHODE SDIACSS — Saisie Incidente</h2>
<div class="table-scroll"><table>
<tr><th>Lettre</th><th>Action</th></tr>
<tr><td><strong>S</strong> — Situation</td><td>Contexte de la découverte incidente</td></tr>
<tr><td><strong>D</strong> — Description</td><td>Description précise de l'objet saisi</td></tr>
<tr><td><strong>I</strong> — Interpellation</td><td>Question à l'intéressé sur l'origine</td></tr>
<tr><td><strong>A</strong> — Avis Parquet</td><td>Avis immédiat obligatoire</td></tr>
<tr><td><strong>C</strong> — Cadre juridique</td><td>FD ou procédure incidente</td></tr>
<tr><td><strong>S</strong> — Saisie</td><td>Saisie formalisée dans le PV</td></tr>
<tr><td><strong>S</strong> — Scellé</td><td>Constitution du scellé numéroté</td></tr>
</table></div>
<div class="piege"><strong>⚠️ Saisie incidente :</strong> Objet rattaché infraction en FD = avis Parquet immédiat + ouverture nouvelle procédure + extension GAV aux nouveaux faits.</div>`,
art1:`<h1>⏱️ Ligne du Temps — Enquête ALPHA (Flagrant Délit)</h1>
<p><em>Scénario type : Vol dans local d'habitation — 10h30 — Flagrant Délit complet</em></p>
<h2>Chronologie des 20 actes</h2>
<div class="timeline-item"><div class="tl-num">01</div><div class="tl-time">10h30</div><div class="tl-title"><strong>SAISINE — PLAINTE C/X</strong><br><small>Victime — Art. 10-2 CPP — Droits — Avis Parquet + hiérarchie</small></div></div>
<div class="timeline-item"><div class="tl-num">02</div><div class="tl-time">11h00</div><div class="tl-title"><strong>PRÉSENTATION PHOTOS TAJ à victime</strong><br><small>Fichier TAJ — Présentation formalisée</small></div></div>
<div class="timeline-item"><div class="tl-num">03</div><div class="tl-time">11h10</div><div class="tl-title"><strong>IDENTIFICATION suspect</strong><br><small>Suite présentation TAJ</small></div></div>
<div class="timeline-item"><div class="tl-num">04</div><div class="tl-time">11h20</div><div class="tl-title"><strong>RECHERCHES FICHIERS</strong><br><small>TAJ, FPR, FNAEG, FAED, SNPC, FOVES…</small></div></div>
<div class="timeline-item"><div class="tl-num">05</div><div class="tl-time">11h40</div><div class="tl-title"><strong>VÉRIFICATION DE DOMICILE (VD)</strong><br><small>Vérification préalable adresse suspect</small></div></div>
<div class="timeline-item"><div class="tl-num">06</div><div class="tl-time">12h00</div><div class="tl-title"><strong>TRANSPORT / CONSTATATIONS</strong><br><small>SDPTS + Vidéoprotection + Album photo</small></div></div>
<div class="timeline-item"><div class="tl-num">07</div><div class="tl-time">12h20</div><div class="tl-title"><strong>ENQUÊTE DE VOISINAGE (EV)</strong><br><small>Gardiens X et Y — Résultat</small></div></div>
<div class="timeline-item"><div class="tl-num" style="background:var(--err)">08</div><div class="tl-time">13h15</div><div class="tl-title"><strong>TRANSPORT / INTERPELLATION ← DÉBUT GAV</strong><br><small>Menottage Art. 803 — Palpation — Notification verbale GAV</small></div></div>
<div class="timeline-item"><div class="tl-num">09</div><div class="tl-time">13h20</div><div class="tl-title"><strong>NOTIFICATION PLACEMENT EN GAV (PV séparé)</strong><br><small>6 objectifs Art. 62-2 — Droits Art. 63-1 à 63-4-3 — Formulaire remis</small></div></div>
<div class="timeline-item"><div class="tl-num">10</div><div class="tl-time">13h30</div><div class="tl-title"><strong>AVIS PARQUET</strong><br><small>Obligatoire dès placement en GAV</small></div></div>
<div class="timeline-item"><div class="tl-num">11</div><div class="tl-time">13h35</div><div class="tl-title"><strong>FOUILLE INTÉGRALE</strong><br><small>Nécessité justifiée — Résultat + scellé ou négatif</small></div></div>
<div class="timeline-item"><div class="tl-num">12</div><div class="tl-time">14h00</div><div class="tl-title"><strong>PERQUISITION domicile suspect</strong><br><small>Présence constante du MEC — Saisie + scellé n° DEUX</small></div></div>
<div class="timeline-item"><div class="tl-num">13</div><div class="tl-time">15h30</div><div class="tl-title"><strong>ENTRETIEN AVOCAT</strong><br><small>30 min — Sans délai de carence (Loi 22/04/2024)</small></div></div>
<div class="timeline-item"><div class="tl-num">14</div><div class="tl-time">16h00</div><div class="tl-title"><strong>CONSTITUTION DE GROUPE</strong><br><small>Pour présentation aux témoins/victimes</small></div></div>
<div class="timeline-item"><div class="tl-num">15</div><div class="tl-time">16h30</div><div class="tl-title"><strong>PRÉSENTATION DE GROUPE</strong><br><small>En présence de l'avocat</small></div></div>
<div class="timeline-item"><div class="tl-num">16</div><div class="tl-time">17h00</div><div class="tl-title"><strong>PLAINTE C/ MEC dénommé</strong><br><small>Plainte victime contre suspect identifié</small></div></div>
<div class="timeline-item"><div class="tl-num">17</div><div class="tl-time">17h30</div><div class="tl-title"><strong>AUDITION MEC (gardé à vue)</strong><br><small>En présence avocat — Droits rappelés</small></div></div>
<div class="timeline-item"><div class="tl-num">18</div><div class="tl-time">18h30</div><div class="tl-title"><strong>COMPTE-RENDU PARQUET</strong><br><small>Instructions substitut — COPJ / Défèrement / Classement</small></div></div>
<div class="timeline-item"><div class="tl-num">19</div><div class="tl-time">18h45</div><div class="tl-title"><strong>SIGNALISATION GÉNÉTIQUE</strong><br><small>Art. 706-55 CPP — Prélèvement buccal — FNAEG</small></div></div>
<div class="timeline-item"><div class="tl-num" style="background:var(--ok)">20</div><div class="tl-time">19h00</div><div class="tl-title"><strong>NOTIFICATION FIN GAV ET SUITES</strong><br><small>Droits rappelés — COPJ ou défèrement — Signature</small></div></div>
<div class="ok"><strong>✓ Règle d'or :</strong> Chaque acte = un PV distinct avec cartouche. Les heures doivent être chronologiques et cohérentes. GAV = acte 08 (interpellation), jamais l'arrivée au service.</div>
<div class="piege"><strong>⚠️ Pièges ALPHA :</strong> (1) Heure GAV débute à l'interpellation. (2) Avocat sans délai depuis loi 22/04/2024. (3) Plainte dénommé uniquement après identification formelle. (4) Signalisation génétique = Art. 706-55 CPP.</div>`,
lame:`<h1>⚖️ Méthode LAME — Fiche Mémo Infraction</h1>
<p>La méthode <strong>LAME</strong> structure l'analyse de toute infraction en 4 éléments constitutifs obligatoires.</p>
<h2>L — Élément Légal</h2>
<div class="table-scroll"><table>
<tr><th>Composante</th><th>Contenu</th></tr>
<tr><td>Article de définition</td><td>Article XX CP/CPP qui prévoit et définit l'infraction</td></tr>
<tr><td>Article de répression</td><td>Article XX qui fixe la peine (emprisonnement + amende)</td></tr>
<tr><td>Circonstances aggravantes</td><td>Articles des aggravations (effraction, récidive, bande organisée…)</td></tr>
<tr><td>Classification (Art. 111-1 CP)</td><td>Crime / Délit / Contravention</td></tr>
</table></div>
<h2>A — Élément Actuel / Matériel</h2>
<div class="table-scroll"><table>
<tr><th>Aspect</th><th>Contenu</th></tr>
<tr><td>Faits constatés</td><td>Tous éléments objectifs prouvant la matérialité de l'infraction</td></tr>
<tr><td>Nature des actes</td><td>Unique ou pluralité — Instantané ou continu dans le temps</td></tr>
<tr><td>Commission ou omission</td><td>Action active ou inaction contraire à l'ordre social</td></tr>
<tr><td>Preuves matérielles</td><td>Scellés, témoignages, constatations, rapports PTS</td></tr>
</table></div>
<h2>M — Élément Moral (Culpabilité)</h2>
<div class="table-scroll"><table>
<tr><th>Type de faute</th><th>Définition</th><th>Exemples</th></tr>
<tr><td><strong>Dol général</strong></td><td>Conscience + volonté d'accomplir l'acte</td><td>Vol, meurtre, coups</td></tr>
<tr><td><strong>Intentionnelle</strong></td><td>Volonté dirigée vers le résultat précis</td><td>Homicide volontaire</td></tr>
<tr><td><strong>Non-intentionnelle</strong></td><td>Imprudence, négligence, maladresse</td><td>Homicide par imprudence</td></tr>
<tr><td><strong>Mise en danger délibérée</strong></td><td>Violation manifestement délibérée obligation sécurité</td><td>Art. 223-1 CP</td></tr>
<tr><td><strong>Contraventionnelle</strong></td><td>Simple matérialité, sans intention requise</td><td>Infractions routières</td></tr>
</table></div>
<p style="font-size:11px;font-style:italic">Formule type démontrant la conscience : « L'intéressé, en état de conscience pleine et entière, a volontairement… »</p>
<h2>E — Enrôlement / Responsabilité Pénale</h2>
<div class="table-scroll"><table>
<tr><th>Situation</th><th>Formule</th></tr>
<tr><td>Responsabilité pleine</td><td>NOM Prénom engage sa responsabilité pénale pleine et entière</td></tr>
<tr><td>Irresponsabilité</td><td>Ne peut donner lieu à poursuites — motif : trouble mental, contrainte, minorité</td></tr>
<tr><td>Tentative (Art. 121-5)</td><td>Commencement exécution + absence désistement volontaire</td></tr>
<tr><td>Complicité (Art. 121-7)</td><td>Fait principal punissable + participation + intention de participer</td></tr>
<tr><td>Immunité familiale</td><td>Au préjudice ascendant/descendant/conjoint (hors documents indispensables)</td></tr>
</table></div>
<h2>Tripartition des Infractions (Art. 111-1 CP)</h2>
<div class="table-scroll"><table>
<tr><th>Nature</th><th>Peine max</th><th>Juridiction</th><th>Prescription AP</th><th>Prescription peine</th></tr>
<tr><td><strong>CRIME</strong></td><td>Réclusion / Perpétuité</td><td>Cour d'Assises</td><td>20 ans</td><td>20 ans</td></tr>
<tr><td><strong>DÉLIT</strong></td><td>Emprisonnement + amende</td><td>Tribunal Correctionnel</td><td>6 ans</td><td>6 ans</td></tr>
<tr><td><strong>CONTRAVENTION</strong></td><td>Amende (R, C1 à C5)</td><td>Tribunal de Police</td><td>1 an</td><td>3 ans</td></tr>
</table></div>
<div class="piege"><strong>⚠️ La classification détermine :</strong> Régime de GAV · Durée de prescription · Juridiction compétente · Quantum de peine. Une erreur de qualification peut faire tomber toute la procédure.</div>`,
bloc1:`<h1>🏛️ Libertés Publiques &amp; Acteurs de la PJ</h1>
<h2>Libertés Fondamentales</h2>
<div class="table-scroll"><table>
<tr><th>Liberté</th><th>Définition</th><th>Base juridique</th></tr>
<tr><td><strong>La Sûreté</strong></td><td>Droit de n'être ni arrêté ni détenu arbitrairement</td><td>DDHC 1789</td></tr>
<tr><td><strong>Aller et venir</strong></td><td>Droit de se déplacer librement, pas d'arrestation hors cadre légal</td><td>Préambule Const. 1958</td></tr>
</table></div>
<h2>Mesures de Privation de Liberté</h2>
<div class="table-scroll"><table>
<tr><th>Mesure</th><th>Article</th><th>Durée max</th><th>Notes</th></tr>
<tr><td>Garde à vue</td><td>Art. 62-2 CPP</td><td>24H + 24H (CDO +48H+48H)</td><td>Seul l'OPJ peut placer</td></tr>
<tr><td>Contrôle d'identité</td><td>Art. 78-2 CPP</td><td>Temps nécessaire</td><td>OPJ, APJ, APJA</td></tr>
<tr><td>Vérification d'identité</td><td>Art. 78-3 CPP</td><td>4H maximum</td><td>Sur décision OPJ</td></tr>
<tr><td>Relevé d'identité</td><td>Art. 78-6 CPP</td><td>—</td><td>Contravention seulement</td></tr>
</table></div>
<h2>Vérification d'Identité — Procédure (Art. 78-3 CPP)</h2>
<div class="cartouche"><div class="cartouche-title">Procédure stricte</div>
<ul>
<li>Recherche <strong>coercitive</strong> sur décision de l'OPJ</li>
<li><strong>4H maximum</strong> — strictement nécessaire à découvrir l'identité véritable</li>
<li>Causes : contrôle d'identité, relevé d'identité, recueil d'identité → la personne refuse ou ne peut justifier</li>
<li>Avis à toute personne de son choix + avis au Procureur de la République</li>
<li>Fin : destruction empreintes FAED dans les 6 mois</li>
</ul></div>
<h2>Les Acteurs de la Police Judiciaire (Art. 15 à 21 CPP)</h2>
<div class="table-scroll"><table>
<tr><th>Acteur</th><th>Rôle principal</th></tr>
<tr><td>Procureur de la République</td><td>Dirige et contrôle l'enquête de police judiciaire — Décide des poursuites</td></tr>
<tr><td>OPJ</td><td>Direction effective des enquêtes — GAV — Perquisitions — Chef d'enquête</td></tr>
<tr><td>APJ</td><td>Sous direction OPJ — Constatations, auditions déléguées</td></tr>
<tr><td>APJA</td><td>Actes très limités — recueil identité, constatations simples</td></tr>
<tr><td>Juge d'Instruction</td><td>Instruction judiciaire — Mandats — Commission rogatoire</td></tr>
<tr><td>Maires et adjoints</td><td>OPJ de droit dans certaines matières</td></tr>
</table></div>
<h2>Contrôle de la PJ</h2>
<div class="table-scroll"><table>
<tr><th>Instance</th><th>Type de contrôle</th></tr>
<tr><td>PG près la Cour d'Appel</td><td>Contrôle hiérarchique des OPJ du ressort</td></tr>
<tr><td>Inspection Générale de la Justice</td><td>Contrôle disciplinaire</td></tr>
<tr><td>Chambre de l'instruction</td><td>Contrôle juridictionnel des actes d'enquête (nullités)</td></tr>
</table></div>
<h2>Suites Possibles à l'Enquête</h2>
<div class="table-scroll"><table>
<tr><th>Décision du PR</th><th>Mode</th></tr>
<tr><td>Engagement des poursuites</td><td>COPJ, CPPV, CRPC, CI (Comparution Immédiate)</td></tr>
<tr><td>Alternative aux poursuites</td><td>Rappel à la loi, médiation, stage, réparation, composition pénale</td></tr>
<tr><td>Classement sans suite</td><td>Infraction non constituée ou inopportunité — recours possible PG</td></tr>
</table></div>
<div class="ok"><strong>Avis Parquet — 4 moments obligatoires (Art. 40 CPP) :</strong> (1) Constatation infraction · (2) Privation de liberté · (3) Demande prolongation GAV · (4) Fin de GAV</div>`,
bloc2:`<h1>🗃️ Fichiers Police &amp; Réquisitions</h1>
<h2>Fichiers liés aux Personnes</h2>
<div class="table-scroll"><table>
<tr><th>Sigle</th><th>Nom complet</th><th>Contenu clé</th></tr>
<tr><td><strong>TAJ</strong></td><td>Traitement des Antécédents Judiciaires</td><td>Mises en cause, victimes, témoins — Art. 230-6 CPP</td></tr>
<tr><td><strong>FPR</strong></td><td>Fichier des Personnes Recherchées</td><td>Personnes sous mandat, fugitifs, disparitions</td></tr>
<tr><td><strong>FNAEG</strong></td><td>Fichier National Empreintes Génétiques</td><td>Profils ADN — Art. 706-55 CPP — <strong>Réquisition permanente</strong></td></tr>
<tr><td><strong>FAED</strong></td><td>Fichier Automatisé Empreintes Digitales</td><td>Empreintes digitales/palmaires — <strong>Réquisition permanente</strong></td></tr>
<tr><td><strong>FIJAISV</strong></td><td>Fichier Judiciaire Auteurs Infr. Sexuelles/Violentes</td><td>Condamnés ISV — Obligations de pointage</td></tr>
<tr><td><strong>FIJAIT</strong></td><td>Fichier Judiciaire Auteurs Infr. Terroristes</td><td>Condamnés pour terrorisme</td></tr>
</table></div>
<h2>Fichiers liés aux Véhicules</h2>
<div class="table-scroll"><table>
<tr><th>Sigle</th><th>Nom</th><th>Usage</th></tr>
<tr><td><strong>FOVES</strong></td><td>Fichier Objets Véhicules Signalés</td><td>Véhicules volés, objets signalés</td></tr>
<tr><td><strong>SNPC</strong></td><td>Système National Permis de Conduire</td><td>Validité permis, solde de points</td></tr>
<tr><td><strong>SIV</strong></td><td>Système d'Immatriculation des Véhicules</td><td>Identification propriétaire</td></tr>
<tr><td><strong>FVA</strong></td><td>Fichier Véhicules Assurés</td><td>Vérification assurance</td></tr>
<tr><td><strong>EUCARIS</strong></td><td>Système européen d'immatriculation</td><td>Véhicules étrangers</td></tr>
<tr><td><strong>ADOC</strong></td><td>Accès Dossier Contraventions</td><td>Historique infractions routières</td></tr>
</table></div>
<h2>Les Réquisitions — Cadre Juridique</h2>
<div class="table-scroll"><table>
<tr><th>Cadre</th><th>Article</th><th>Autorité requérante</th><th>Spécificité</th></tr>
<tr><td>Flagrant délit</td><td>Art. 60 CPP</td><td>OPJ directement</td><td>Pas d'autorisation préalable</td></tr>
<tr><td>Enquête préliminaire</td><td>Art. 77-1 CPP</td><td>Sur autorisation PR</td><td>Autorisation préalable obligatoire</td></tr>
<tr><td>FNAEG + FAED</td><td>Art. 706-55 CPP</td><td>OPJ directement</td><td><strong>Réquisitions permanentes — EP incluse</strong></td></tr>
</table></div>
<h2>Types de Réquisitions</h2>
<div class="table-scroll"><table>
<tr><th>Type</th><th>Objet</th></tr>
<tr><td>Générales</td><td>Force publique, moyens de l'État</td></tr>
<tr><td>À personnes qualifiées</td><td>Experts, médecins, UMJ, techniciens</td></tr>
<tr><td>Informatiques</td><td>Opérateurs télécom, FAI — données de connexion et identification</td></tr>
<tr><td>À manœuvrier</td><td>Ouverture de coffres, serrures, véhicules</td></tr>
<tr><td>Prélèvement sanguin</td><td>Alcoolémie, dépistage de stupéfiants</td></tr>
<tr><td>Bancaires (FICOBA)</td><td>Comptes bancaires et mouvements financiers</td></tr>
<tr><td>X-Ray téléphone</td><td>Analyse données téléphone — hors enquête — par personne qualifiée</td></tr>
<tr><td>Interceptions (Art. 100 CPP)</td><td>Uniquement en information judiciaire (JI)</td></tr>
</table></div>
<div class="ok"><strong>✓ Objectif :</strong> La manifestation de la vérité. Toute réquisition = PV de réquisition + réponse écrite du requis.</div>
<div class="piege"><strong>⚠️ FNAEG / FAED :</strong> Réquisitions permanentes = l'OPJ peut accéder sans autorisation du Parquet, même en enquête préliminaire.</div>`
};

function renderPrintList(){
  const el=document.getElementById('print-list');if(!el)return;
  if(typeof PRINT_SHEETS==='undefined'||!PRINT_SHEETS.length){
    el.innerHTML='<div class="empty-state"><span class="empty-state-em">📄</span>Aucune fiche disponible</div>';return;
  }
  const printed=S.printed||{};
  el.innerHTML=`<div class="print-grid">${PRINT_SHEETS.map((s,i)=>{
    const done=!!(printed[s.id]||printed[s.id+'_viewed']);
    return`<div class="print-card2${done?' done':''}" onclick="PRINT28.open('${s.id}')" style="animation:fadeUp .15s ${i*0.04}s both">
      <div class="print-card2-top">
        <div class="print-card2-em">${s.emoji}</div>
        ${done?`<div class="print-card2-check">✓</div>`:`<div class="print-card2-dl">↓</div>`}
      </div>
      <div class="print-card2-title">${s.title}</div>
      <div class="print-card2-sub">${s.sub}</div>
      <div class="print-card2-footer">
        <span class="print-card2-cta">${done?'Réimprimer':'Ouvrir la fiche'}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}


