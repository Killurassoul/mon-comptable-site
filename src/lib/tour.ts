// Single config object for the download page.
export const CONFIG = {
  DOWNLOAD_URL: "https://example.com/MonComptable-Setup.exe",
  VERSION: "2.4.0",
  FILE_SIZE: "86 Mo",
  WHATSAPP: "+221 77 000 00 00",
  EMAIL: "contact@moncomptable.sn",
};

// Hex copies of the brand tokens for WebGL (CSS uses the oklch tokens in styles.css).
export const BRAND_HEX = { accent: "#7c3aed", sidebar: "#0f172a" };

export const CHAPTERS = [
  {
    label: "Tableau de bord",
    start: 0.3,
    end: 0.5,
    title: "Votre trésorerie, en clair.",
    text: "Recettes, dépenses et factures en attente réunies sur un seul écran, à jour à chaque écriture.",
  },
  {
    label: "Écritures",
    start: 0.5,
    end: 0.66,
    title: "Saisissez. L'appli équilibre.",
    text: "Chaque pièce saisie est contrôlée : l'écart reste affiché tant que débit et crédit ne sont pas égaux.",
  },
  {
    label: "Paie",
    start: 0.66,
    end: 0.8,
    title: "La fiche de paie en PDF, en un clic.",
    text: "Choisissez un salarié, vérifiez son bulletin et exportez-le prêt à imprimer ou à envoyer.",
  },
  {
    label: "Assistant",
    start: 0.8,
    end: 0.9,
    title: "Posez la question, la réponse arrive.",
    text: "Solde, créances, dépenses du mois : la réponse s'appuie sur vos propres écritures.",
  },
] as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Chapter index for scroll value p: -1 before the tour, 0..3 during and after. */
export function chapterAt(p: number): number {
  if (p < CHAPTERS[0]!.start) return -1;
  for (let i = 0; i < CHAPTERS.length; i++) if (p < CHAPTERS[i]!.end) return i;
  return CHAPTERS.length - 1;
}

/** Scroll value to jump to when a sidebar item is clicked. */
export const chapterTarget = (i: number) => (CHAPTERS[i]!.start + CHAPTERS[i]!.end) / 2;

/** FCFA amounts with space-separated thousands. */
export function fcfa(n: number): string {
  const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + s;
}
