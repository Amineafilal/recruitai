/** Arrière-plan animé « vague orange et blanc » pour les pages d'auth. */
export function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white">
      {/* dégradé qui ondule */}
      <div
        className="wave-pan absolute inset-0"
        style={{ backgroundImage: "linear-gradient(120deg, #FFFFFF 0%, #FFF3EE 30%, #FFE1D3 55%, #FFF6F1 80%, #FFFFFF 100%)" }}
      />
      {/* blobs orange qui dérivent */}
      <div
        className="blob-drift absolute -left-24 -top-24 h-[440px] w-[440px] rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle, rgba(251,109,76,0.45), transparent 70%)" }}
      />
      <div
        className="blob-drift absolute -right-24 top-[18%] h-[540px] w-[540px] rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, rgba(255,150,90,0.40), transparent 70%)", animationDelay: "-6s", animationDirection: "reverse" }}
      />
      <div
        className="blob-drift absolute bottom-[-18%] left-[28%] h-[520px] w-[520px] rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, rgba(251,109,76,0.30), transparent 70%)", animationDelay: "-12s" }}
      />
      {/* vague SVG douce en bas */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 220" preserveAspectRatio="none" style={{ height: "26vh" }} aria-hidden>
        <path fill="#FB6D4C" fillOpacity="0.10" d="M0 120 C 360 40 720 200 1080 120 C 1260 80 1380 120 1440 130 L1440 220 L0 220 Z" />
        <path fill="#FB6D4C" fillOpacity="0.16" d="M0 160 C 360 100 720 220 1080 160 C 1260 130 1380 160 1440 168 L1440 220 L0 220 Z" />
      </svg>
    </div>
  );
}
