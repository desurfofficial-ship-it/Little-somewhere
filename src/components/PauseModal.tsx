import React from 'react';
import { RESIDENT_ORDER } from '../game/residents';
import { WorldState } from '../game/types';

interface PauseModalProps {
  open: boolean;
  world: WorldState;
  onResume: () => void;
  onResetWorld: () => void;
  onReturnToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  open,
  world,
  onResume,
  onResetWorld,
  onReturnToTitle,
}) => {
  if (!open) return null;

  const metCount = Object.values(world.residents).filter((r) => r.met).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/50 pointer-events-auto">
      <div
        role="dialog"
        aria-label="Game Paused"
        className="w-full max-w-md bg-linen border border-stone-line rounded-2xl shadow-elevation-drawer p-6"
      >
        <h2 className="font-display text-2xl font-bold text-espresso">
          Resting for a Moment
        </h2>
        <p className="text-sm text-espresso-muted mt-1">
          Your neighborhood progress is saved automatically.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-[#F2E9DA] border border-parchment">
            <div className="font-mono-nums text-xl font-bold text-espresso">{world.day}</div>
            <div className="text-xs text-espresso-muted">Day</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F2E9DA] border border-parchment">
            <div className="font-mono-nums text-xl font-bold text-espresso">
              {metCount}/{RESIDENT_ORDER.length}
            </div>
            <div className="text-xs text-espresso-muted">Neighbors</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F2E9DA] border border-parchment">
            <div className="font-mono-nums text-xl font-bold text-espresso">{world.memories.length}</div>
            <div className="text-xs text-espresso-muted">Memories</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] rounded-xl bg-terracotta hover:bg-terracotta-deep text-base font-semibold text-linen transition-colors cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full min-h-[46px] rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC6] border border-stone-line text-sm font-semibold text-espresso transition-colors cursor-pointer"
          >
            Return to Title
          </button>
          <button
            type="button"
            onClick={onResetWorld}
            className="w-full min-h-[44px] rounded-xl bg-transparent hover:bg-[#EFE5D5] text-sm font-medium text-[#7D4B3B] transition-colors cursor-pointer"
          >
            Start Fresh Neighborhood
          </button>
        </div>
      </div>
    </div>
  );
};
