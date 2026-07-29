/**
 * Pastille de score circulaire.
 *
 * `score` à null signifie « pas de note » (scoring en échec), ce qui n'est pas
 * la même chose qu'un score de 0 — lequel est une vraie évaluation négative.
 * Les deux doivent rester visuellement distincts, sinon un profil que l'IA n'a
 * pas réussi à traiter se ferait écarter comme s'il avait été jugé mauvais.
 */
export function ScoreRing({ score, size = 52 }: { score: number | null; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  if (score === null || score === undefined) {
    return (
      <div
        className="relative inline-grid place-items-center"
        style={{ width: size, height: size }}
        title="Le scoring n'a pas abouti pour ce profil"
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E7E1D5"
            strokeWidth={stroke}
            strokeDasharray="4 5"
          />
        </svg>
        <span className="absolute font-mono font-bold text-ink-faint" style={{ fontSize: size * 0.3 }}>
          —
        </span>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, score));
  const offset = circ * (1 - clamped / 100);
  const color = clamped >= 80 ? "#16A34A" : clamped >= 55 ? "#FB6D4C" : "#9A9CB0";

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7E1D5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <span className="absolute font-mono font-bold tabular-nums" style={{ fontSize: size * 0.3, color }}>
        {clamped}
      </span>
    </div>
  );
}
