/* Gribouillis dessinés à la main (style agence Maruncy). Purement décoratifs. */

export function Squiggle({ className = "", color = "#FB6D4C" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="60" height="18" viewBox="0 0 60 18" fill="none" aria-hidden>
      <path d="M2 12 Q 9 2 16 12 T 30 12 T 44 12 T 58 12" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className = "", color = "#FB6D4C" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <path d="M15 2 C 16 10 20 14 28 15 C 20 16 16 20 15 28 C 14 20 10 16 2 15 C 10 14 14 10 15 2 Z" fill={color} />
    </svg>
  );
}

export function CurveArrow({ className = "", color = "#20223D" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="54" height="46" viewBox="0 0 54 46" fill="none" aria-hidden>
      <path d="M4 4 C 30 6 46 18 44 40" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M35 33 L44 41 L50 31" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Ring({ className = "", color = "#63D2C3" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="10" stroke={color} strokeWidth="3.5" />
    </svg>
  );
}

export function Dots({ className = "", color = "#FBBF24" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="52" height="52" viewBox="0 0 52 52" fill={color} aria-hidden>
      {[4, 18, 32, 46].map((y) =>
        [4, 18, 32, 46].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" />),
      )}
    </svg>
  );
}
