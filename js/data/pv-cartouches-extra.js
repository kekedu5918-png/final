/* OPJ Elite — canevas PV complémentaires (8 scénarios rédactionnels + rappels SDIACSS) */
'use strict';
window.__OPJ_CT_EXTRA__ = {
  st_const: {
    ti: 'PV — Saisine, transport, constatations',
    st: 'Méthode SDIACSS · Art. 53 et s. CPP (flagrance)',
    fs: [
      { id: 'ct-sc-sit', l: 'S — Situation (cadre, heure, lieu, unité OPJ)', t: 'ta', h: 'Qui saisit, pourquoi, contexte opérationnel', r: true },
      { id: 'ct-sc-datetime', l: 'Date et heure précises de la saisine / premier contact', t: 'dt', r: true },
      { id: 'ct-sc-opj', l: 'OPJ saisissant / matricules / service', t: 'text', h: 'Rédacteur et co-signataires éventuels', r: true },
      { id: 'ct-sc-desc', l: 'D — Description factuelle (constatations initiales)', t: 'ta', h: 'Faits constatés sans interprétation juridique hâtive', r: true },
      { id: 'ct-sc-inter', l: 'I — Interpellation / première mesure', t: 'text', h: 'Identification des personnes, mesures de sûreté', r: true },
      { id: 'ct-sc-avis', l: 'A — Avis au parquet', t: 'text', h: 'Heure, canal, consignes reçues', r: true },
      { id: 'ct-sc-cadre', l: 'C — Cadre juridique invoqué', t: 'text', h: 'Ex. enquête de flagrance art. 53 CPP', r: true },
      { id: 'ct-sc-qualif', l: 'Qualification(s) provisoire(s) / infractions visées', t: 'text', r: false },
      { id: 'ct-sc-pers', l: 'Personnes présentes / identifiées et rôle (témoins, victimes, tiers)', t: 'ta', r: false },
      { id: 'ct-sc-saisie', l: 'Saisie / scellés (si applicable)', t: 'ta', h: 'Objets relevés, scellés, photos', r: false }
    ]
  },
  st_inter_pub: {
    ti: 'PV — Interpellation sur voie publique',
    st: 'Flagrance · usage de la force proportionné · art. 73 / 78-3 CPP selon cas',
    fs: [
      { id: 'ct-ip-lieu', l: 'Lieu précis (adresse, repères)', t: 'text', r: true },
      { id: 'ct-ip-datetime', l: 'Date et heure de l\'interpellation', t: 'dt', r: true },
      { id: 'ct-ip-cadre-j', l: 'Cadre juridique (flagrance art. 53, AP, réquisition PR, autre)', t: 'ta', r: true },
      { id: 'ct-ip-circonstances', l: 'Circonstances de l\'interpellation', t: 'ta', h: 'Comportement, opposants, témoins', r: true },
      { id: 'ct-ip-id', l: 'Identité de la personne interpellée', t: 'text', r: true },
      { id: 'ct-ip-vuln', l: 'Mineur / vulnérabilité / personne à besoin d\'accompagnement', t: 'text', r: false },
      { id: 'ct-ip-force', l: 'Usage de la contrainte (si oui : nature, proportionnalité, blessures)', t: 'ta', r: false },
      { id: 'ct-ip-droits', l: 'Information des droits (audition libre / GAV selon hypothèse)', t: 'ta', r: true },
      { id: 'ct-ip-bwv', l: 'Vidéo-protection / BWV (mention si enregistrement ou absence)', t: 'text', r: false },
      { id: 'ct-ip-suite', l: 'Suite donnée (GAV, audition, présentation)', t: 'text', r: true }
    ]
  },
  tr_inter_dom: {
    ti: 'PV — Transport après interpellation à domicile',
    st: 'Chaîne horaire · présence lors des fouilles · respect domicile',
    fs: [
      { id: 'ct-td-heure', l: 'Heure d\'interpellation / sortie des lieux', t: 'dt', r: true },
      { id: 'ct-td-adresse', l: 'Adresse du domicile', t: 'text', r: true },
      { id: 'ct-td-entree', l: 'Cadre d\'accès au domicile (consentement, réquisition, flagrance, autre)', t: 'ta', r: true },
      { id: 'ct-td-presence', l: 'Personnes présentes (occupant, cohabitants, mineurs, témoins)', t: 'ta', r: true },
      { id: 'ct-td-fouille-dom', l: 'Fouilles / palpations / visites au domicile (déroulé, consentement, objets)', t: 'ta', r: false },
      { id: 'ct-td-transport', l: 'Modalités de transport vers les locaux', t: 'ta', h: 'Véhicule, escorte, incidents éventuels', r: true },
      { id: 'ct-td-arrivee', l: 'Heure d\'arrivée au service', t: 'dt', r: true }
    ]
  },
  st_plainte: {
    ti: 'PV — Saisine par plainte',
    st: 'Art. 10-2 CPP — droits de la victime — enregistrement',
    fs: [
      { id: 'ct-pl-ident', l: 'Identité du plaignant', t: 'text', r: true },
      { id: 'ct-pl-datetime', l: 'Date et heure d\'enregistrement de la plainte', t: 'dt', r: true },
      { id: 'ct-pl-faits', l: 'Faits déclarés (verbatim ou résumé fidèle)', t: 'ta', r: true },
      { id: 'ct-pl-mode', l: 'Modalité (plainte simple / avec constitution de partie civile / orientation main courante si applicable)', t: 'text', r: true },
      { id: 'ct-pl-102', l: 'Information des droits (art. 10-2 CPP)', t: 'ta', h: 'Droit de déposer plainte, suite possible, aide, interprète…', r: true },
      { id: 'ct-pl-lang', l: 'Langue d\'audition / interprète (mention)', t: 'text', r: false },
      { id: 'ct-pl-victime', l: 'Mesures d\'urgence évoquées (protection, ordonnance pénale…)', t: 'ta', r: false },
      { id: 'ct-pl-cons', l: 'Consentements / oppositions éventuelles', t: 'text', r: false },
      { id: 'ct-pl-lectsig', l: 'Lecture du PV au plaignant / signature / mention de refus', t: 'ta', r: true },
      { id: 'ct-pl-suite', l: 'Suite opérationnelle (référence, orientation, transmission parquet)', t: 'text', r: true }
    ]
  },
  st_temoin: {
    ti: 'PV — Saisine / audition de témoin',
    st: 'Art. 61 CPP · serment / engagement de dire la vérité selon cadre',
    fs: [
      { id: 'ct-te-ident', l: 'Identité du témoin', t: 'text', r: true },
      { id: 'ct-te-datetime', l: 'Date, heure et lieu de l\'audition', t: 'dt', r: true },
      { id: 'ct-te-lien', l: 'Lien avec les faits', t: 'text', r: true },
      { id: 'ct-te-mineur', l: 'Majorité / représentation légale si mineur', t: 'text', r: false },
      { id: 'ct-te-audition', l: 'Déclarations (chronologie)', t: 'ta', r: true },
      { id: 'ct-te-serment', l: 'Serment / engagement de dire la vérité (mention dans PV)', t: 'text', r: true },
      { id: 'ct-te-confront', l: 'Confrontation (réalisée, ajournée ou sans objet — mention)', t: 'text', r: false },
      { id: 'ct-te-cadre', l: 'Cadre procédural (audition libre, garde à vue témoin si hypothèse, autres)', t: 'ta', r: false },
      { id: 'ct-te-sign', l: 'Lecture / signature / refus', t: 'text', r: true }
    ]
  },
  tr_perq: {
    ti: 'PV — Transport / arrivée sur lieu de perquisition',
    st: 'Présence constante · art. 56 / 57 / 76 CPP selon cadre',
    fs: [
      { id: 'ct-tp-cadre', l: 'Cadre juridique (FD / EP / CR)', t: 'text', r: true },
      { id: 'ct-tp-depart', l: 'Lieu et heure de prise en route', t: 'dt', r: true },
      { id: 'ct-tp-arrivee', l: 'Heure d\'arrivée sur les lieux', t: 'dt', r: true },
      { id: 'ct-tp-presence', l: 'Personnes présentes (occupant, OPJ, témoins art. 57)', t: 'ta', r: true },
      { id: 'ct-tp-menottes', l: 'Contraintes / art. 803 CPP si personne à menotter pendant fouille', t: 'text', r: false }
    ]
  },
  fouille_corps: {
    ti: 'PV — Fouille intégrale (personne)',
    st: 'Décision d\'engager la fouille · dignité · témoins si requis — distinguer palpation sécurité (78-2-2) / fouille à corps',
    fs: [
      { id: 'ct-fc-base', l: 'Base légale et décision (qui ordonne / cadre exact)', t: 'text', r: true },
      { id: 'ct-fc-datetime', l: 'Date, heure (début / fin si pertinent)', t: 'dt', r: true },
      { id: 'ct-fc-cadre-type', l: 'Nature d\'acte (palpation de sécurité art. 78-2-2 CPP / fouille à corps selon cadre procédural — ne pas confondre)', t: 'ta', r: true },
      { id: 'ct-fc-lieu', l: 'Lieu de la fouille', t: 'text', r: true },
      { id: 'ct-fc-ident', l: 'Identité de la personne fouillée', t: 'text', r: true },
      { id: 'ct-fc-sexe', l: 'OPJ de même sexe ou mesures de respect (mention)', t: 'text', r: false },
      { id: 'ct-fc-deroulement', l: 'Déroulement (respect de la personne, modalités, déshabillage partiel si applicable)', t: 'ta', r: true },
      { id: 'ct-fc-objets', l: 'Objets découverts et devenir (saisie, scellés)', t: 'ta', r: true },
      { id: 'ct-fc-refus', l: 'Opposition / refus partiel / contestation (mention factuelle)', t: 'ta', r: false },
      { id: 'ct-fc-temoins', l: 'Second OPJ / témoins présents', t: 'text', r: false }
    ]
  },
  fouille_veh: {
    ti: 'PV — Fouille de véhicule',
    st: 'Identification du véhicule · périmètre · inventaire',
    fs: [
      { id: 'ct-fv-immat', l: 'Immatriculation / marque / type', t: 'text', r: true },
      { id: 'ct-fv-detenteur', l: 'Conducteur / détenteur des lieux du véhicule', t: 'text', r: true },
      { id: 'ct-fv-cadre', l: 'Cadre (FD / mandat / consentement)', t: 'text', r: true },
      { id: 'ct-fv-fouille', l: 'Zones fouillées et méthode', t: 'ta', r: true },
      { id: 'ct-fv-saisie', l: 'Objets saisis et scellés', t: 'ta', r: true }
    ]
  }
};
