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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D241E]/50 pointer-events-auto">
      <div
        role="dialog"
        aria-label="Game Paused"
        className="w-full max-w-md bg-[#FAF5EC] border border-[#D4C4AE] rounded-2xl shadow-[0_20px_54px_rgba(45,36,30,0.28)] p-6"
      >
        <h2 className="font-display text-2xl font-bold text-[#2D241E]">
          Resting for a Moment
        </h2>
        <p className="text-sm text-[#6A5B50] mt-1">
          Your neighborhood progress is saved automatically.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-[#F2E9DA] border border-[#E2D4C0]">
            <div className="font-mono-nums text-xl font-bold text-[#2D241E]">{world.day}</div>
            <div className="text-xs text-[#6A5B50]">Day</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F2E9DA] border border-[#E2D4C0]">
            <div className="font-mono-nums text-xl font-bold text-[#2D241E]">
              {metCount}/{RESIDENT_ORDER.length}
            </div>
            <div className="text-xs text-[#6A5B50]">Neighbors</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F2E9DA] border border-[#E2D4C0]">
            <div className="font-mono-nums text-xl font-bold text-[#2D241E]">{world.memories.length}</div>
            <div className="text-xs text-[#6A5B50]">Memories</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] rounded-xl bg-[#C86446] hover:bg-[#B45539] text-base font-semibold text-[#FAF5EC] transition-colors cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full min-h-[46px] rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC6] border border-[#D4C4AE] text-sm font-semibold text-[#2D241E] transition-colors cursor-pointer"
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
