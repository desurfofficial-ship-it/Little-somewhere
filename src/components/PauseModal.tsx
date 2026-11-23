import React, { useRef, useState } from 'react';
import { RESIDENT_ORDER } from '../game/residents';
import { WorldState } from '../game/types';
import { useDialogA11y } from './useDialogA11y';

interface PauseModalProps {
  open: boolean;
  world: WorldState;
  onResume: () => void;
  onResetWorld: () => void;
  onReturnToTitle: () => void;
}

/** One calm desktop shortcut row (UI/UX program WP4 — the full control set was
 *  previously taught nowhere after the title screen). */
const SHORTCUT_ROWS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: 'WASD / Arrows', label: 'Walk' },
  { keys: 'E', label: 'Interact with the nearest thing' },
  { keys: 'J', label: 'Pocket Journal' },
  { keys: 'I', label: 'Satchel & Keepsakes' },
  { keys: 'G', label: 'Set down a carried item' },
  { keys: 'Shift', label: 'Sprint · Alt walks slowly' },
  { keys: 'Wheel', label: 'Zoom the camera' },
  { keys: 'M', label: 'Mute · Esc / P pause' },
];

export const PauseModal: React.FC<PauseModalProps> = ({
  open,
  world,
  onResume,
  onResetWorld,
  onReturnToTitle,
}) => {
  // UI/UX program WP1: resetting the world is destructive and irreversible —
  // it must never fire on a single unconfirmed activation (keyboard users
  // could previously reach it behind an open backdrop).
  const [resetArmed, setResetArmed] = useState<boolean>(false);
  // UI/UX program (WP3): shared focus kit for the pause surface.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogA11y(dialogRef, open);

  if (!open) return null;

  const metCount = Object.values(world.residents).filter((r) => r.met).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/50 pointer-events-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
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

        {/* Desktop shortcut reference — closes the "controls taught nowhere" gap */}
        <div className="hidden sm:block mt-4 rounded-xl bg-[#F2E9DA] border border-parchment px-3.5 py-3">
          <div className="text-[11px] font-semibold tracking-wide text-espresso-muted uppercase mb-1.5">
            Keyboard reference
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {SHORTCUT_ROWS.map((row) => (
              <li key={row.keys} className="flex items-center gap-1.5 min-w-0">
                <kbd className="font-mono-nums font-semibold text-espresso bg-linen border border-stone-line rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap">
                  {row.keys}
                </kbd>
                <span className="text-xs text-umber truncate">{row.label}</span>
              </li>
            ))}
          </ul>
          <div className="sm:hidden mt-1.5 text-xs text-umber">
            Touch: thumbstick to walk, tap anything to interact.
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] rounded-xl bg-terracotta-deep hover:bg-terracotta text-base font-semibold text-linen transition-colors cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full min-h-[46px] rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC5] border border-stone-line text-sm font-semibold text-espresso transition-colors cursor-pointer"
          >
            Return to Title
          </button>
          <button
            type="button"
            onClick={() => {
              if (!resetArmed) {
                setResetArmed(true);
                return;
              }
              setResetArmed(false);
              onResetWorld();
            }}
            onBlur={() => setResetArmed(false)}
            aria-label={
              resetArmed
                ? 'Confirm: erase this neighborhood and start fresh'
                : 'Start a fresh neighborhood (erases saved progress)'
            }
            className={`w-full min-h-[44px] rounded-xl text-sm font-medium transition-colors cursor-pointer border ${
              resetArmed
                ? 'bg-terracotta-deep hover:bg-terracotta-deep text-linen border-terracotta-deep'
                : 'bg-transparent hover:bg-[#EFE5D5] text-[#7D4B3B] border-transparent'
            }`}
          >
            {resetArmed ? 'Erase everything and start fresh?' : 'Start Fresh Neighborhood'}
          </button>
        </div>
      </div>
    </div>
  );
};
