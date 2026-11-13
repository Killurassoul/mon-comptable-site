// Single config object for the download page.
export const CONFIG = {
  // Les binaires sont trop lourds pour l'hébergement Vercel (limite de 100 Mo par
  // fichier) et pour l'historique git : ils sont publiés en release GitHub de ce dépôt.
  // URL stable : pointe toujours vers l'asset de la dernière release publiée.
  DOWNLOAD_URL:
    import.meta.env["VITE_DOWNLOAD_URL"] ||
    "https://github.com/Killurassoul/mon-comptable-site/releases/latest/download/MonComptable-Setup.exe",
  RELEASES_URL: "https://github.com/Killurassoul/mon-comptable-site/releases",
  VERSION: "3.5.1",
  RELEASED_AT: "2026-11-13",
  FILE_SIZE: "122 Mo",
  FILE_BYTES: 127934394,
  SHA256: "e0f71c42d92ea3cfb6d1aa9bedb0bb14abb0a64f99863876528d30ea6b28acf5",
  WHATSAPP: "+221 77 762 11 43",
  EMAIL: "rassoulgye@gmail.com",
};

/** Date de publication de l'installeur, en français (ex. « 8 novembre 2026 »). */
export const RELEASE_DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(`${CONFIG.RELEASED_AT}T12:00:00`));

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
