export type Feature = {
  title: string;
  short: string;
  text: string;
};

/** Les douze modules réellement présents dans l'application. */
export const FEATURES: Feature[] = [
  {
    title: "Tableau de bord sur mesure",
    short: "Neuf widgets à afficher, redimensionner et réordonner.",
    text: "Trésorerie, flux, charges, créances, dettes, taxe, paie, ratios et mobile money : chaque bloc se place où vous voulez.",
  },
  {
    title: "Écritures en partie double",
    short: "Journaux, contrôle d'équilibre, pièces justificatives.",
    text: "Chaque pièce est contrôlée au débit et au crédit, avec saisie en langage naturel et justificatif rattaché.",
  },
  {
    title: "Imports CSV et Excel",
    short: "Relevés bancaires et journaux de caisse en quelques secondes.",
    text: "Un écran de validation signale les doublons et les lignes incomplètes avant l'enregistrement définitif.",
  },
  {
    title: "Lecture des reçus",
    short: "Une photo suffit pour retrouver montant, date et fournisseur.",
    text: "Le justificatif photographié propose les champs utiles, puis se rattache à l'écriture correspondante.",
  },
  {
    title: "Facturation et relances",
    short: "Factures et devis en PDF, relances et encaissements suivis.",
    text: "Chaque règlement enregistré génère l'écriture ; les règles de relance évitent les impayés oubliés.",
  },
  {
    title: "Clients et fournisseurs",
    short: "Grand livre auxiliaire, balance âgée, historique complet.",
    text: "Le détail par tiers montre les règlements, les soldes et les retards, sans quitter le dossier.",
  },
  {
    title: "Trésorerie multi-comptes",
    short: "Banque, caisse, Wave, Orange Money, MTN et Free réunis.",
    text: "Tous les comptes dans une même vue, avec rapprochement bancaire et contrôle des écarts.",
  },
  {
    title: "Dettes fournisseurs",
    short: "Échéancier des achats à crédit et alertes de retard.",
    text: "Le règlement en un clic crée la charge correspondante et met l'échéancier à jour.",
  },
  {
    title: "Paie et ressources humaines",
    short: "Salariés, bulletins PDF, congés et masse salariale.",
    text: "Les contrats, les bulletins et les absences alimentent le même dossier que la comptabilité.",
  },
  {
    title: "Fiscalité et échéances",
    short: "Taxe collectée, déductible, acomptes et dépôt annuel.",
    text: "Les rappels arrivent avant la date limite, avec le détail des montants déclarés et payés.",
  },
  {
    title: "Rapports de gestion",
    short: "Balance, grand livre, prévisions et ratios exportables.",
    text: "Comparateur de périodes, courbe de trésorerie et dossier bancaire prêts à transmettre.",
  },
  {
    title: "Agent comptable intégré",
    short: "Un assistant qui lit le dossier et propose les écritures.",
    text: "Il produit des rapports, exécute la demande et laisse une trace : chaque action est horodatée et attribuée.",
  },
];
