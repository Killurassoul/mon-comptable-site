import {
  BarChart3,
  BookOpenCheck,
  Coins,
  FileSpreadsheet,
  FileText,
  HandCoins,
  HardDriveDownload,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  WifiOff,
  ArrowRight,
  Check,
} from "lucide-react";

import { CONFIG } from "@/lib/tour";
import { FEATURES } from "@/lib/features";
import { FeaturesRibbon } from "@/components/mc/FeaturesRibbon";

const ICONS = [
  LayoutDashboard,
  BookOpenCheck,
  FileSpreadsheet,
  ScanLine,
  FileText,
  Users,
  Wallet,
  HandCoins,
  Users,
  Landmark,
  BarChart3,
  Sparkles,
];

const EXTRAS = [
  { Icon: Coins, label: "Multi-devises avec taux manuels" },
  { Icon: HardDriveDownload, label: "Sauvegarde et restauration JSON" },
  { Icon: KeyRound, label: "Licences hors ligne et rôles" },
  { Icon: WifiOff, label: "Aucune donnée envoyée sans action" },
];

const AUDIT_POINTS = [
  {
    title: "Chaîne SHA-256",
    text: "Chaque opération est signée avec l'empreinte de la précédente. Modifier une ligne casse la chaîne, et l'application le détecte immédiatement.",
  },
  {
    title: "Scellés de période",
    text: "Vous figez une période close dans un scellé horodaté, puis vous vérifiez plus tard qu'aucune écriture n'a bougé.",
  },
  {
    title: "Preuve exportable",
    text: "Le registre complet s'exporte pour un comptable, un contrôleur ou un financement, sans dépendre d'un service en ligne.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Télécharger",
    text: `Le fichier fait ${CONFIG.FILE_SIZE} et s'installe hors ligne.`,
  },
  {
    n: "2",
    title: "Exécuter",
    text: "Windows demande une confirmation ; les données restent sur le poste.",
  },
  {
    n: "3",
    title: "Activer",
    text: "Saisissez la clé de licence, puis créez votre dossier en quelques écrans.",
  },
];

const FAQ = [
  {
    q: "Le logiciel fonctionne-t-il vraiment sans internet ?",
    a: "Oui. Comptabilité, facturation, paie et rapports fonctionnent entièrement hors ligne, avec les données stockées sur votre ordinateur. Seul l'agent comptable a besoin d'une connexion et de votre propre clé API, et uniquement lorsque vous l'utilisez.",
  },
  {
    q: "Où sont stockées mes données ?",
    a: "Sur le poste, dans l'application. Aucune copie n'est envoyée sur un serveur. Vous pouvez exporter une sauvegarde JSON complète depuis Paramètres, puis la restaurer sur un autre ordinateur.",
  },
  {
    q: "Quelles versions de Windows sont prises en charge ?",
    a: "Windows 10 et Windows 11 en 64 bits. Une version macOS n'est pas encore publiée.",
  },
  {
    q: "Puis-je essayer avant d'acheter une licence ?",
    a: "Oui. Le mode démonstration autorise un volume limité d'écritures par mois et appose un filigrane sur les PDF. Une clé de licence lève ces limites.",
  },
  {
    q: "Puis-je importer mon historique comptable ?",
    a: "Oui, depuis un fichier CSV ou Excel : relevé bancaire, journal de caisse ou export mobile money. L'écran de validation signale les doublons et les lignes incomplètes avant l'enregistrement.",
  },
  {
    q: "Comment obtenir une licence ou une démonstration ?",
    a: `Écrivez-nous sur WhatsApp au ${CONFIG.WHATSAPP} ou par email à ${CONFIG.EMAIL}. Chaque licence est liée à un nombre d'appareils précis et s'active hors ligne.`,
  },
];

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mc-sec-head">
      <p className="mc-eyebrow">{eyebrow}</p>
      <h2 className="mc-h2">{title}</h2>
      {lead && <p className="mc-sec-lead">{lead}</p>}
    </div>
  );
}

export function SiteExtras() {
  return (
    <>
      <section id="fonctionnalites" className="mc-fr-section">
        <FeaturesRibbon />
        <div className="mc-section mc-section--detail">
          <SectionHead
            eyebrow="Le détail des modules"
            title="Ce que chaque module fait, concrètement."
            lead="Les deux rubans et la grille parlent des mêmes écritures : un seul dossier, aucune ressaisie."
          />
          <div className="mc-features">
            {FEATURES.map((feature, i) => {
              const Icon = ICONS[i] ?? Sparkles;
              return (
                <article key={feature.title} className="mc-feature">
                  <span className="mc-feature-icon">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
          <div className="mc-extras">
            {EXTRAS.map(({ Icon, label }) => (
              <span key={label} className="mc-extra">
                <Icon size={16} /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="tracabilite" className="mc-section mc-section--panel">
        <div className="mc-audit">
          <div className="mc-audit-copy">
            <SectionHead
              eyebrow="Registre inaltérable"
              title="Chaque écriture laisse une empreinte vérifiable."
              lead="Le dossier se contrôle comme un journal de caisse : les opérations sont chaînées, horodatées et attribuées à un utilisateur."
            />
            <ul className="mc-audit-list">
              {AUDIT_POINTS.map((point) => (
                <li key={point.title}>
                  <ShieldCheck size={18} />
                  <div>
                    <b>{point.title}</b>
                    <p>{point.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mc-audit-card" aria-hidden="true">
            <div className="mc-audit-row">
              <span>Écriture</span>
              <b>F-0142 · 1 180 000</b>
            </div>
            <div className="mc-audit-row">
              <span>Acteur</span>
              <b>Gérant</b>
            </div>
            <div className="mc-audit-row">
              <span>Horodatage</span>
              <b>03/11/2026 09:14</b>
            </div>
            <div className="mc-audit-hash">
              <small>Empreinte</small>
              <code>9f2c 41ab 7e05 d3c8 … 04f1</code>
            </div>
            <div className="mc-audit-ok">
              <Check size={16} /> Chaîne vérifiée
            </div>
          </div>
        </div>
      </section>

      <section id="installation" className="mc-section">
        <SectionHead
          eyebrow="Installation"
          title="Trois étapes, aucune dépendance."
          lead={`Version ${CONFIG.VERSION} · ${CONFIG.FILE_SIZE} · Windows 10 et 11 en 64 bits.`}
        />
        <div className="mc-steps">
          {STEPS.map((step) => (
            <article key={step.n} className="mc-step">
              <span className="mc-step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="mc-install-panel">
          <div>
            <b>Mon Comptable pour Windows</b>
            <p>
              Version {CONFIG.VERSION} · {CONFIG.FILE_SIZE} · exécutable signé hors ligne. Empreinte
              SHA-256 :
            </p>
            <code className="mc-sha">{CONFIG.SHA256}</code>
          </div>
          <a className="mc-btn mc-btn--accent mc-btn--lg" href={CONFIG.DOWNLOAD_URL} rel="noopener">
            Télécharger pour Windows <ArrowRight size={18} />
          </a>
        </div>
        <p className="mc-help mc-help--inline">
          Windows affiche un avertissement au premier lancement ? Cliquez sur « Informations
          complémentaires », puis « Exécuter quand même ». Le fichier est identique à celui de la
          version {CONFIG.VERSION}.
        </p>
      </section>

      <section id="faq" className="mc-section">
        <SectionHead eyebrow="Questions fréquentes" title="Ce que l'on nous demande le plus." />
        <div className="mc-faq">
          {FAQ.map((item) => (
            <details key={item.q} className="mc-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mc-footer">
        <div className="mc-footer-main">
          <div>
            <b>Mon Comptable</b>
            <p>
              Comptabilité, trésorerie et paie pour les PME, cabinets et associations d'Afrique de
              l'Ouest.
            </p>
          </div>
          <div className="mc-footer-links">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#tracabilite">Traçabilité</a>
            <a href="#installation">Installation</a>
            <a href="#faq">Questions fréquentes</a>
          </div>
          <div className="mc-footer-contact">
            <a href={`https://wa.me/${CONFIG.WHATSAPP.replace(/\D/g, "")}`}>
              WhatsApp {CONFIG.WHATSAPP}
            </a>
            <a href={`mailto:${CONFIG.EMAIL}`}>{CONFIG.EMAIL}</a>
          </div>
        </div>
        <div className="mc-footer-legal">
          <span>Version {CONFIG.VERSION} · Windows est une marque de Microsoft Corporation.</span>
          <span>Données hébergées sur votre ordinateur.</span>
        </div>
      </footer>
    </>
  );
}
