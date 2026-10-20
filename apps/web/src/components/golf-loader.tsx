/**
 * The BookOn logo, moving: the ball rolls into the hole and the flag waves
 * (Milestone 18). It fades in after a moment, so quick loads never flash it,
 * and keeps still for people who ask their device to reduce motion.
 */
export function GolfLoader({ label = "Loading", size = 72 }: { label?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className="golf-loader flex flex-col items-center gap-3">
      <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden>
        <rect width="512" height="512" rx="112" fill="var(--logo-green)" />
        <ellipse cx="256" cy="392" rx="132" ry="30" fill="var(--logo-white)" fillOpacity="0.22" />
        <ellipse cx="226" cy="392" rx="30" ry="9" fill="var(--logo-hole)" />
        <path d="M226 392V124" stroke="var(--logo-white)" strokeWidth="30" strokeLinecap="round" />
        <path
          className="flag"
          d="M241 112 L372 160 L241 208 Z"
          fill="var(--logo-flag)"
          stroke="var(--logo-flag)"
          strokeWidth="14"
          strokeLinejoin="round"
        />
        <circle className="ball" cx="318" cy="370" r="22" fill="var(--logo-white)" />
      </svg>
      <span className="text-sm text-muted">{label}…</span>
    </div>
  );
}
