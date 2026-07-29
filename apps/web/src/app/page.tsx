import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Squiggle, Sparkle, CurveArrow, Ring, Dots } from "@/components/Doodles";
import { ContactSection } from "@/components/ContactSection";

// Palette « Maruncy » propre à la landing (n'affecte pas le dashboard bleu).
const CORAL = "#FB6D4C";
const CORAL_DARK = "#E85835";
const TEAL = "#63D2C3";
const NAVY = "#1C1E3A";

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden bg-[#F6F2EB] text-[#20223D]">
      <Nav />
      <Hero />
      <Services />
      <Sources />
      <Testimonials />
      <Pricing />
      <ContactSection />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ---------------------------------- Nav ---------------------------------- */
function Nav() {
  return (
    <header className="sticky top-0 z-40 bg-[#F6F2EB]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[70px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-[15px] font-extrabold text-white" style={{ background: CORAL }}>R</span>
          <span className="text-[18px] font-extrabold tracking-tight">RecruitAI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[14px] font-semibold text-[#4a4c63] lg:flex">
          <a href="#services" className="hover:text-[#20223D]">Services</a>
          <a href="#avis" className="hover:text-[#20223D]">Avis</a>
          <a href="#tarifs" className="hover:text-[#20223D]">Tarifs</a>
          <a href="#contact" className="hover:text-[#20223D]">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/connexion" className="hidden text-[14px] font-semibold text-[#4a4c63] hover:text-[#20223D] sm:block">
            Se connecter
          </Link>
          <Link href="/inscription" className="rounded-full px-5 py-2.5 text-[14px] font-bold text-white transition-transform hover:scale-[1.03]" style={{ background: CORAL }}>
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------- Hero ---------------------------------- */
function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-16">
      {/* doodles */}
      <Sparkle className="absolute left-4 top-10 hidden lg:block" color={CORAL} />
      <Dots className="absolute right-2 top-6 hidden lg:block" color="#F4B740" />

      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* left */}
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#4a4c63] shadow-[0_6px_20px_-8px_rgba(20,20,40,0.25)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
            Sourcing IA pour agences de recrutement
          </span>

          <h1 className="hero-in mt-6 text-[46px] font-extrabold leading-[1.02] tracking-tight sm:text-[62px]">
            Placez plus,
            <br />
            cherchez{" "}
            <span className="relative inline-block" style={{ color: CORAL }}>
              moins
              <Squiggle className="absolute -bottom-3 left-0 w-full" color={CORAL} />
            </span>
          </h1>

          <p className="mt-7 max-w-md text-[17px] leading-relaxed text-[#5a5c72]">
            RecruitAI source et score automatiquement vos candidats, et réactive votre CVthèque dormante.
            Une shortlist qualifiée livrée à vos recruteurs chaque matin.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/inscription" className="rounded-full px-7 py-4 text-[15px] font-bold text-white shadow-[0_14px_30px_-10px_rgba(251,109,76,0.7)] transition-transform hover:scale-[1.03]" style={{ background: CORAL }}>
              Créer mon agence
            </Link>
            <Link href="/demo/tableau-de-bord" className="text-[15px] font-bold text-[#20223D] underline-offset-4 hover:underline">
              Voir la démo →
            </Link>
            <CurveArrow className="hidden sm:block" color={NAVY} />
          </div>

          <div className="mt-9 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["#FB6D4C", "#63D2C3", "#1C1E3A", "#F4B740"].map((c) => (
                <span key={c} className="h-8 w-8 rounded-full border-2 border-[#F6F2EB]" style={{ background: c }} />
              ))}
            </div>
            <p className="text-[13px] font-medium text-[#5a5c72]">
              <span className="font-bold text-[#20223D]">Opérationnel en 48h</span> · sans engagement
            </p>
          </div>
        </div>

        {/* right — visuel dans un blob turquoise */}
        <div className="relative">
          <Ring className="absolute -left-2 top-4 z-10 hidden lg:block" color={CORAL} />
          <Sparkle className="absolute -right-1 bottom-6 z-10 hidden lg:block" color={TEAL} />
          {/* blob */}
          <svg viewBox="0 0 520 520" className="absolute inset-0 h-full w-full" aria-hidden>
            <path
              fill={TEAL}
              d="M431 92C479 140 512 213 500 279c-11 66-67 124-129 158-63 34-131 43-188 21C126 436 80 383 55 322 30 261 26 191 58 138 90 84 158 46 228 34c70-12 155 10 203 58Z"
              opacity="0.9"
            />
          </svg>
          <div className="relative px-4 py-8">
            <ProductPreview />
            {/* petite carte flottante score */}
            <div className="absolute -bottom-2 -left-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_40px_-16px_rgba(20,20,40,0.4)]">
              <span className="grid h-11 w-11 place-items-center rounded-full text-[15px] font-extrabold text-white" style={{ background: CORAL }}>95</span>
              <div>
                <div className="text-[13px] font-bold text-[#20223D]">Candidat scoré</div>
                <div className="text-[11px] text-[#8a8ca0]">correspondance IA</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  const stats = [
    { l: "Postes", v: "12" },
    { l: "Candidats", v: "1 240" },
    { l: "Chauds", v: "318" },
  ];
  const rows = [
    { n: "Cyril Cessou", s: 95 },
    { n: "Gaëtan Busato", s: 92 },
    { n: "Mehdi Chekkouch", s: 88 },
  ];
  return (
    <div className="mx-auto max-w-md rotate-[1.5deg] rounded-2xl border border-black/5 bg-white p-4 shadow-[0_30px_70px_-30px_rgba(20,20,40,0.5)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-extrabold text-[#20223D]">Shortlist du matin</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: TEAL }}>En direct</span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.l} className="rounded-lg bg-[#F6F2EB] p-2 text-center">
            <div className="text-[16px] font-extrabold text-[#20223D]">{s.v}</div>
            <div className="text-[10px] text-[#8a8ca0]">{s.l}</div>
          </div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={r.n} className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-black/5" : ""}`}>
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 font-mono text-[11px] font-bold" style={{ borderColor: CORAL, color: CORAL_DARK }}>{r.s}</span>
          <div className="flex-1 text-[13px] font-bold text-[#20223D]">{r.n}</div>
          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: CORAL }}>Valider</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Services ------------------------------- */
function Services() {
  const items = [
    {
      icon: "M3 7h18v13H3z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
      title: "Sourcing IA",
      text: "Scraping multi-sources et scoring automatique. Une shortlist de 10-15 candidats qualifiés chaque matin.",
      featured: false,
    },
    {
      icon: "M12 2 3 7l9 5 9-5-9-5z|M3 12l9 5 9-5",
      title: "Réactivation CVthèque",
      text: "On enrichit votre base dormante, on détecte les candidats prêts à bouger et on relance au bon moment.",
      featured: true,
    },
    {
      icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
      title: "Conformité RGPD",
      text: "Désinscription automatique, exclusion des opt-out, données hébergées en Europe. Conforme par conception.",
      featured: false,
    },
  ];
  return (
    <section id="services" className="relative mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: CORAL }}>Ce qu'on fait pour votre agence</p>
        <h2 className="mt-3 text-[34px] font-extrabold leading-tight tracking-tight sm:text-[42px]">
          Tout le sourcing, <span className="relative inline-block">automatisé<Squiggle className="absolute -bottom-2 left-0 w-full" color={TEAL} /></span>
        </h2>
      </Reveal>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 90}>
            <div
              className={`h-full rounded-3xl p-8 transition-transform hover:-translate-y-1 ${it.featured ? "text-white" : "bg-white text-[#20223D] shadow-[0_20px_50px_-30px_rgba(20,20,40,0.4)]"}`}
              style={it.featured ? { background: CORAL } : {}}
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={it.featured ? { background: "rgba(255,255,255,0.2)" } : { background: "#FFF0EB" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={it.featured ? "#fff" : CORAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  {it.icon.split("|").map((p, k) => <path key={k} d={p} />)}
                </svg>
              </span>
              <h3 className="mt-5 text-[21px] font-extrabold">{it.title}</h3>
              <p className={`mt-2.5 text-[15px] leading-relaxed ${it.featured ? "text-white/85" : "text-[#5a5c72]"}`}>{it.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Sources -------------------------------- */
function Sources() {
  const items = ["LinkedIn", "Indeed", "Apec", "Welcome to the Jungle", "Beetween", "Recruitee"];
  const row = [...items, ...items];
  return (
    <section className="border-y border-black/5 bg-white py-10">
      <p className="mb-6 text-center text-[12px] font-bold uppercase tracking-wider text-[#a0a2b4]">Connecté à toutes vos sources</p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee flex w-max items-center gap-14">
          {row.map((n, i) => <span key={i} className="whitespace-nowrap text-[19px] font-extrabold text-[#c4c6d4]">{n}</span>)}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Testimonials ----------------------------- */
// NOTE : contenu à remplacer par de vrais témoignages de bêta-testeurs.
function Testimonials() {
  const avis = [
    { q: "En deux semaines, mes recruteurs ont arrêté de passer leurs matinées sur LinkedIn. La shortlist est là au réveil.", n: "Directeur d'agence", r: "Cabinet généraliste, Lyon" },
    { q: "La réactivation de CVthèque a sorti des candidats qu'on avait complètement oubliés. Deux placements dès le premier mois.", n: "Responsable recrutement", r: "Agence tech, Paris" },
  ];
  return (
    <section id="avis" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: CORAL }}>Ce qu'en disent les agences</p>
        <h2 className="mt-3 text-[34px] font-extrabold tracking-tight sm:text-[42px]">Des retours qui parlent</h2>
      </Reveal>
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        {avis.map((a, i) => (
          <Reveal key={i} delay={i * 100}>
            <div className="h-full rounded-3xl p-8 text-white" style={{ background: NAVY }}>
              <div className="mb-4 text-[22px]" style={{ color: "#F4B740" }}>★★★★★</div>
              <p className="text-[17px] leading-relaxed text-white/90">“{a.q}”</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full text-[14px] font-extrabold text-white" style={{ background: CORAL }}>{a.n[0]}</span>
                <div>
                  <div className="text-[14px] font-bold">{a.n}</div>
                  <div className="text-[12px] text-white/50">{a.r}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Pricing -------------------------------- */
function Pricing() {
  const plans = [
    { nom: "Starter", prix: "299 €", pts: ["1-3 recruteurs", "5 postes actifs", "CVthèque : 10 000"], featured: false },
    { nom: "Growth", prix: "699 €", pts: ["4-10 recruteurs", "20 postes actifs", "CVthèque : 50 000"], featured: true },
    { nom: "Scale", prix: "1 499 €", pts: ["11-30 recruteurs", "Postes illimités", "CVthèque illimitée"], featured: false },
    { nom: "Enterprise", prix: "Sur devis", pts: ["30+ recruteurs", "Illimité + API", "Intégrations ATS"], featured: false },
  ];
  return (
    <section id="tarifs" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: CORAL }}>Tarifs</p>
        <h2 className="mt-3 text-[34px] font-extrabold tracking-tight sm:text-[42px]">Quelle formule vous convient ?</h2>
        <p className="mt-4 text-[16px] text-[#5a5c72]">−20 % avec engagement annuel. Sans engagement mensuel.</p>
      </Reveal>
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => (
          <Reveal key={p.nom} delay={i * 70}>
            <div
              className={`relative flex h-full flex-col rounded-3xl p-7 ${p.featured ? "text-white shadow-[0_24px_60px_-24px_rgba(251,109,76,0.6)]" : "bg-white text-[#20223D] shadow-[0_20px_50px_-30px_rgba(20,20,40,0.35)]"}`}
              style={p.featured ? { background: CORAL } : {}}
            >
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#20223D] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Populaire</span>
              )}
              <div className="text-[15px] font-bold">{p.nom}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[32px] font-extrabold tracking-tight">{p.prix}</span>
                {p.prix !== "Sur devis" && <span className={`text-[14px] ${p.featured ? "text-white/70" : "text-[#a0a2b4]"}`}>/mois</span>}
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {p.pts.map((pt) => (
                  <li key={pt} className={`flex items-center gap-2 text-[14px] ${p.featured ? "text-white/90" : "text-[#5a5c72]"}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.featured ? "#fff" : TEAL} strokeWidth="3"><path d="m5 12 5 5L20 7" /></svg>
                    {pt}
                  </li>
                ))}
              </ul>
              <Link
                href="/inscription"
                className={`mt-6 rounded-full px-4 py-2.5 text-center text-[14px] font-bold transition-transform hover:scale-[1.03] ${p.featured ? "bg-white text-[#E85835]" : "text-white"}`}
                style={p.featured ? {} : { background: NAVY }}
              >
                Commencer
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- Final CTA ------------------------------- */
function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] px-8 py-16 text-center text-white" style={{ background: NAVY }}>
          <Sparkle className="absolute left-8 top-8" color={CORAL} />
          <Ring className="absolute right-10 top-10" color={TEAL} />
          <Dots className="absolute bottom-6 left-14 hidden sm:block" color="#F4B740" />
          <h2 className="mx-auto max-w-2xl text-[32px] font-extrabold tracking-tight sm:text-[44px]">Prêt à transformer votre sourcing ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] text-white/70">Créez votre agence en une minute. Opérationnel en 48h, sans engagement.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/inscription" className="rounded-full px-7 py-4 text-[15px] font-bold text-white transition-transform hover:scale-[1.03]" style={{ background: CORAL }}>
              Créer mon agence
            </Link>
            <Link href="/connexion" className="rounded-full border border-white/30 px-7 py-4 text-[15px] font-bold text-white hover:bg-white/10">
              Se connecter
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* -------------------------------- Footer --------------------------------- */
function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-extrabold text-white" style={{ background: CORAL }}>R</span>
          <span className="text-[15px] font-extrabold text-[#20223D]">RecruitAI</span>
        </div>
        <p className="text-[13px] text-[#a0a2b4]">© {new Date().getFullYear()} RecruitAI — Sourcing automatisé pour agences de recrutement.</p>
        <div className="flex gap-5 text-[13px] font-semibold text-[#5a5c72]">
          <Link href="/connexion" className="hover:text-[#20223D]">Connexion</Link>
          <a href="#tarifs" className="hover:text-[#20223D]">Tarifs</a>
          <a href="#contact" className="hover:text-[#20223D]">Contact</a>
        </div>
      </div>
    </footer>
  );
}
