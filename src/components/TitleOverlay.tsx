import React from 'react';

interface TitleOverlayProps {
  hasSavedProgress: boolean;
  savedDay: number;
  onStart: () => void;
  onResetAndStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  hasSavedProgress,
  savedDay,
  onStart,
  onResetAndStart,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between items-start pointer-events-none p-4 sm:p-8 md:p-12">
      {/* Upper-left calm storybook card (R-08: slimmer vertical padding keeps more
          of the title-orbit diorama visible above and below the card) */}
      <div className="max-w-md bg-linen/92 border border-stone-line rounded-2xl p-4 sm:p-5.5 shadow-elevation-sheet pointer-events-auto">
        {/* Custom inline SVG storybook crest + title lockup */}
        <div className="inline-flex items-center gap-3 mb-3">
          <svg
            width="42"
            height="42"
            viewBox="0 0 44 44"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="22" cy="22" r="20" fill="#F3EADF" stroke="var(--color-terracotta)" strokeWidth="2" />
            <path
              d="M11 24L22 14L33 24V33H11V24Z"
              fill="var(--color-terracotta)"
              stroke="var(--color-espresso)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M19 33V26H25V33" fill="var(--color-linen)" stroke="var(--color-espresso)" strokeWidth="1.5" />
            <circle cx="22" cy="11" r="2.5" fill="var(--color-honey)" stroke="var(--color-espresso)" strokeWidth="1.2" />
          </svg>
          <span className="text-xs sm:text-sm font-medium tracking-wide text-umber">
            A Cozy Neighborhood Life Sim
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-espresso leading-[1.06] [text-wrap:balance]">
          LITTLE SOMEWHERE
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#3E3128] leading-relaxed">
          Meet your neighbors, discover their stories, build friendships, and help a little world bloom.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-terracotta hover:bg-[#B55639] active:scale-[0.98] text-linen font-semibold text-base shadow-elevation-card transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso whitespace-nowrap shrink-0"
          >
            {hasSavedProgress ? `Continue Day ${savedDay}` : 'Begin Your Day'}
          </button>

          {hasSavedProgress && (
            <button
              type="button"
              onClick={onResetAndStart}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC5] active:scale-[0.98] text-espresso border border-stone-line font-medium text-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso whitespace-nowrap shrink-0"
            >
              Start New Neighborhood
            </button>
          )}
        </div>
      </div>

      {/* Calm bottom control guide with generous breathing room */}
      <div className="bg-linen/94 border border-stone-line/85 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-[#3E3128] shadow-sm flex flex-wrap items-center gap-x-4 gap-y-2 leading-relaxed pointer-events-auto max-w-full">
        <span className="inline-flex items-center gap-1.5">
          <kbd className="font-mono-nums font-semibold text-espresso bg-[#F2E9DA] border border-stone-line rounded px-1.5 py-0.5 text-[11px] sm:text-xs">
            WASD
          </kbd>
          <span>or Tap Ground to Walk</span>
        </span>
        <span className="hidden sm:inline text-[#B8A590]" aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span>Tap Neighbor or</span>
          <kbd className="font-mono-nums font-semibold text-espresso bg-[#F2E9DA] border border-stone-line rounded px-1.5 py-0.5 text-[11px] sm:text-xs">
            E
          </kbd>
          <span>to Talk</span>
        </span>
        <span className="hidden sm:inline text-[#B8A590]" aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="font-mono-nums font-semibold text-espresso bg-[#F2E9DA] border border-stone-line rounded px-1.5 py-0.5 text-[11px] sm:text-xs">
            Esc
          </kbd>
          <span>Pause</span>
        </span>
      </div>
    </div>
  );
};
