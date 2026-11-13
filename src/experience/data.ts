import { CONFIG } from "@/lib/tour";

export interface Screen {
  file: string;
  title: string;
  category: string;
  description: string;
}

/** Vraies captures de l'application, avec une société et des montants fictifs. */
export const SCREENS: Screen[] = [
  {
    file: "dashboard",
    title: "Tableau de bord",
    category: "Pilotage",
    description:
      "Encaissements, décaissements, résultat et trésorerie consolidée, recalculés à chaque écriture.",
  },
  {
    file: "ecritures",
    title: "Journal des opérations",
    category: "Écritures",
    description:
      "Saisie en une phrase, import de relevés et justificatifs rattachés à chaque ligne.",
  },
  {
    file: "bulletin",
    title: "Bulletin de paie",
    category: "Paie",
    description:
      "Brut, retenues et net à payer calculés, puis comptabilisés dans les charges de personnel.",
  },
  {
    file: "facturation",
    title: "Facturation",
    category: "Ventes",
    description: "Factures, échéances et relances. Chaque règlement crée son écriture.",
  },
  {
    file: "tresorerie",
    title: "Comptes et soldes",
    category: "Trésorerie",
    description: "Banque, caisse, Wave et Orange Money réunis dans une seule vue.",
  },
  {
    file: "rapports",
    title: "Rapports et fiscalité",
    category: "Analyse",
    description: "Résultat, taxe collectée et déductible, états prêts à exporter.",
  },
  {
    file: "paie",
    title: "Ressources humaines",
    category: "Paie",
    description: "Salariés, contrats, congés et masse salariale dans le même dossier.",
  },
  {
    file: "registre",
    title: "Registre inaltérable",
    category: "Traçabilité",
    description:
      "Chaque opération est horodatée et chaînée : une modification ne passe pas inaperçue.",
  },
  {
    file: "budget",
    title: "Budget et dettes",
    category: "Trésorerie",
    description: "Dettes fournisseurs, échéancier et prévisions de trésorerie.",
  },
  {
    file: "tiers",
    title: "Clients et fournisseurs",
    category: "Tiers",
    description: "Soldes, règlements et retards, client par client et fournisseur par fournisseur.",
  },
  {
    file: "dossier-bancaire",
    title: "Dossier bancaire",
    category: "Analyse",
    description: "Une synthèse de l'activité prête à transmettre à votre banque.",
  },
];

export const screenUrl = (s: Screen) => `/screens/${s.file}.jpg`;
/** Les captures font 2000 × 1250 px. */
export const SCREEN_ASPECT = 1.6;

export const DOWNLOAD = {
  url: CONFIG.DOWNLOAD_URL,
  version: CONFIG.VERSION,
  size: CONFIG.FILE_SIZE,
  sha: CONFIG.SHA256,
  whatsapp: CONFIG.WHATSAPP,
  whatsappUrl: `https://wa.me/${CONFIG.WHATSAPP.replace(/\D/g, "")}`,
  email: CONFIG.EMAIL,
};

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

export interface ViewHandle {
  start(): void;
  stop(): void;
}

/** Texte dessiné dans un canvas, pour les vues WebGL. Les polices doivent être prêtes. */
export function textCanvas(
  draw: (ctx: CanvasRenderingContext2D) => void,
  w: number,
  h: number,
  dpr = Math.min(window.devicePixelRatio || 1, 2),
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(dpr, dpr);
  draw(ctx);
  return c;
}

export const SANS = '"Geist", ui-sans-serif, system-ui, sans-serif';
export const SERIF = '"Newsreader", ui-serif, Georgia, serif';
export const INK = "#ededeb";
export const MUTE = "#8a8a88";
export const BG = "#0c0c0d";
