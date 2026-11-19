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
      {/* Upper-left calm storybook card */}
      <div className="max-w-md bg-[#FAF5EC]/92 border border-[#D4C4AE] rounded-2xl p-5 sm:p-7 shadow-[0_14px_38px_rgba(45,36,30,0.18)] pointer-events-auto">
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
            <circle cx="22" cy="22" r="20" fill="#F3EADF" stroke="#C86446" strokeWidth="2" />
            <path
              d="M11 24L22 14L33 24V33H11V24Z"
              fill="#C86446"
              stroke="#2D241E"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M19 33V26H25V33" fill="#FAF5EC" stroke="#2D241E" strokeWidth="1.5" />
            <circle cx="22" cy="11" r="2.5" fill="#E5A93C" stroke="#2D241E" strokeWidth="1.2" />
          </svg>
          <span className="text-xs sm:text-sm font-medium tracking-wide text-[#5E5046]">
            A Cozy Neighborhood Life Sim
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#2D241E] leading-[1.06] [text-wrap:balance]">
          LITTLE SOMEWHERE
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#3E3128] leading-relaxed">
          A little world filled with thousands of little stories. Meet nine neighbors, follow their sunlit routines, and help the quiet town square bloom again.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-[#C86446] hover:bg-[#B55639] active:scale-[0.98] text-[#FAF5EC] font-semibold text-base shadow-[0_6px_18px_rgba(45,36,30,0.2)] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D241E] whitespace-nowrap shrink-0"
          >
            {hasSavedProgress ? `Continue Day ${savedDay}` : 'Begin Your Day'}
          </button>

          {hasSavedProgress && (
            <button
              type="button"
              onClick={onResetAndStart}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC5] active:scale-[0.98] text-[#2D241E] border border-[#D4C4AE] font-medium text-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D241E] whitespace-nowrap shrink-0"
            >
              Start New Neighborhood
            </button>
          )}
        </div>
      </div>

      {/* Single flat borderless control hint along bottom safe margin */}
      <div className="bg-[#FAF5EC]/90 border border-[#D4C4AE]/70 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#3E3128] shadow-sm">
        WASD or Tap Ground to Walk · Tap Neighbor or Press E to Talk · Esc Pause
      </div>
    </div>
  );
};
