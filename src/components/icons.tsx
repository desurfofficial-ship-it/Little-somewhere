/**
 * BUILD 04 bespoke icon family (Doc 03 §9.2 / Doc 08 §7.2): a small, consistent
 * SVG set in the storybook voice — 24-viewBox, 1.8 stroke, round caps and
 * joins, gently asymmetric details so nothing reads as stock clip-art. These
 * replace stock lucide glyphs in COZY-CONTEXT slots only (weather, seasons,
 * cozy domains); functional glyphs (close, chevrons, zoom, audio) stay lucide.
 *
 * Semantic inventory (every icon has a documented purpose — no speculative
 * glyphs for nonexistent mechanics):
 *   Weather  · SunIcon (sunlit) · BreezeIcon (breezy) · MistIcon (misty_morning)
 *            · RainIcon (light_rain) — HUD weather label
 *   Seasons  · SpringBlossomIcon · SummerLeafIcon · AutumnLeafIcon
 *            · WinterFlakeIcon — HUD season label
 *   Cozy     · SatchelIcon (gathered goods) · SproutIcon (sowing & growing)
 *            · KeepsakeIcon (gifts & shelf keepsakes) · HeartstringIcon (trust)
 */

interface StorybookIconProps {
  className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Sunlit — a slightly tilted sun with uneven hand-drawn rays. */
export function SunIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12.2" cy="12" r="4.1" />
      <path d="M12.2 3.4v2.1" />
      <path d="M12.2 18.5v2.1" />
      <path d="M3.6 12h2.1" />
      <path d="M18.7 12h2.1" />
      <path d="M6.1 5.9l1.5 1.5" />
      <path d="M17.2 17l1.5 1.5" />
      <path d="M18.4 6.2l-1.5 1.4" />
      <path d="M6.4 17.2l-1.4 1.4" />
    </svg>
  );
}

/** Breezy — three wind lines, the middle one curling. */
export function BreezeIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 8.6h10.2a2.3 2.3 0 1 0-2.2-3" />
      <path d="M3.5 12.6h13.6" />
      <path d="M5.8 16.6h7.4a2.2 2.2 0 1 1-2.1 2.9" />
    </svg>
  );
}

/** Misty morning — a soft cloud above drifting fog lines. */
export function MistIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.8 10.4a4 4 0 0 1 7.2-2.3 3.1 3.1 0 0 1 3.9 3c0 .3 0 .5-.1.8" />
      <path d="M4.8 14.4h12.6" />
      <path d="M7.4 17.6h9.4" />
      <path d="M6.2 20.4h6.8" />
    </svg>
  );
}

/** Light rain — a low cloud with three falling drops. */
export function RainIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.6 12.4a3.9 3.9 0 0 1 7-2.2 3 3 0 0 1 3.7 2.9c0 .5-.1.9-.3 1.3" />
      <path d="M7.8 15.9l-.9 2.3" />
      <path d="M12.1 15.9l-.9 2.3" />
      <path d="M16.4 15.9l-.9 2.3" />
    </svg>
  );
}

/** Spring — a five-petal blossom with a dotted center. */
export function SpringBlossomIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="11.4" r="1.5" />
      <path d="M12 9.9c-.9-1.6-.6-3.6.9-4.7 1.4 1.4 1.3 3.4 0 4.7" />
      <path d="M13.4 11.6c1.8-.5 3.6.4 4.3 2.1-1.8.8-3.7.2-4.7-1.3" />
      <path d="M12.9 13.9c.9 1.6.5 3.7-1 4.8-1.4-1.5-1.3-3.5.1-4.8" />
      <path d="M10.6 13.5c-1.8.5-3.7-.4-4.4-2.2 1.8-.7 3.7 0 4.7 1.5" />
      <path d="M10.9 11c-1.5-1-2-2.9-1.2-4.6" />
      <path d="M12 18.7v2.3" />
    </svg>
  );
}

/** Summer — a leaf riding a small sun disc. */
export function SummerLeafIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9.6" cy="9.2" r="3.4" />
      <path d="M8.4 8.1c.8.2 1.4.9 1.5 1.7" />
      <path d="M14.2 12.6c2.6.5 4.4 2.1 4.9 4.8-2.7.5-5.2-.6-6.3-2.9" />
      <path d="M13.6 16.1c-2.7.5-5.3-.7-6.4-3.2" />
    </svg>
  );
}

/** Autumn — a falling oak-ish leaf with its vein. */
export function AutumnLeafIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12.4 4.6c3.4.7 5.6 3 6 6.5.2 2.4-.7 4.4-2.5 5.8-2.5-1.3-4.2-3.5-4.6-6.5" />
      <path d="M12.4 4.6c-2.3 1.9-3.4 4.4-3.2 7.4.1 2.2 1 4 2.6 5.4" />
      <path d="M12.6 17.8l-1 2.6" />
      <path d="M9.6 10.8l2.6.5" />
    </svg>
  );
}

/** Winter — a six-arm flake with short spurs. */
export function WinterFlakeIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.6v16.8" />
      <path d="M4.8 7.8l14.4 8.4" />
      <path d="M19.2 7.8L4.8 16.2" />
      <path d="M12 6.4l-1.6-1.2" />
      <path d="M12 6.4l1.6-1.2" />
      <path d="M9.3 12l-1.9-.4" />
      <path d="M14.7 12l1.9-.4" />
    </svg>
  );
}

/** Cozy domain: gathered goods — the wanderer's satchel. */
export function SatchelIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.8 9.4c.5-2.4 2.1-3.8 4.6-3.8h1.2c2.5 0 4.1 1.4 4.6 3.8" />
      <path d="M5.6 9.6h12.8c.9 0 1.5.7 1.4 1.6l-.6 6.2c-.1 1.4-1.2 2.4-2.6 2.4H7.4c-1.4 0-2.5-1-2.6-2.4l-.6-6.2c-.1-.9.5-1.6 1.4-1.6Z" />
      <path d="M9.8 13.4h4.4" />
    </svg>
  );
}

/** Cozy domain: sowing & growing — a two-leaf sprout in a soil mound. */
export function SproutIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 19.4v-6.8" />
      <path d="M12 12.6C12 9.8 10.2 8 7.4 7.6 7 10.4 8.8 12.3 12 12.6Z" />
      <path d="M12 11.8c.2-2.4 1.8-4 4.2-4.4.3 2.5-1.4 4.2-4.2 4.4Z" />
      <path d="M7.4 19.4c1.3-1 2.9-1.5 4.6-1.5s3.3.5 4.6 1.5" />
    </svg>
  );
}

/** Cozy domain: gifts & keepsakes — a ribbon-tied parcel. */
export function KeepsakeIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.4 11.2h13.2v8.2c0 .7-.6 1.2-1.3 1.2H6.7c-.7 0-1.3-.5-1.3-1.2v-8.2Z" />
      <path d="M4.4 8.4h15.2v2.8H4.4z" />
      <path d="M12 8.4v12.2" />
      <path d="M12 8.2C10.4 8.2 9.2 7.1 9.2 5.7c0-1 .8-1.7 1.8-1.5.7.1 1 .7 1 1.4" />
      <path d="M12 8.2c1.6 0 2.8-1.1 2.8-2.5 0-1-.8-1.7-1.8-1.5-.7.1-1 .7-1 1.4" />
    </svg>
  );
}

/** Cozy domain: trust & warmth — a small stitched heart. */
export function HeartstringIcon({ className }: StorybookIconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 19.6C7.6 16.4 4.8 13.6 4.8 10.4c0-2.2 1.6-3.8 3.7-3.8 1.4 0 2.7.7 3.5 2 .8-1.3 2.1-2 3.5-2 2.1 0 3.7 1.6 3.7 3.8 0 3.2-2.8 6-7.2 9.2Z" />
      <path d="M8.2 9.8c.5-.8 1.3-1.2 2.2-1.2" />
    </svg>
  );
}

/** Season glyph switch for the HUD (falls back to no glyph for unknown values). */
export function SeasonGlyph({ season, className }: { season: string; className?: string }) {
  switch (season) {
    case 'spring':
      return <SpringBlossomIcon className={className} />;
    case 'summer':
      return <SummerLeafIcon className={className} />;
    case 'autumn':
      return <AutumnLeafIcon className={className} />;
    case 'winter':
      return <WinterFlakeIcon className={className} />;
    default:
      return null;
  }
}

/** Weather glyph switch for the HUD (falls back to no glyph for unknown values). */
export function WeatherGlyph({
  weather,
  className,
}: {
  weather: string;
  className?: string;
}) {
  switch (weather) {
    case 'sunlit':
      return <SunIcon className={className} />;
    case 'breezy':
      return <BreezeIcon className={className} />;
    case 'misty_morning':
      return <MistIcon className={className} />;
    case 'light_rain':
      return <RainIcon className={className} />;
    default:
      return null;
  }
}
