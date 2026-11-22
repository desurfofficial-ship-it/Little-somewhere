import React, { useMemo } from 'react';
import { Check, MapPin, Users, X } from 'lucide-react';
import { getCommunityProjectsView } from '../game/community';
import { getItemCount } from '../game/inventory';
import { PersonalItemId, WorldState } from '../game/types';

interface CommunityProjectsPanelProps {
  open: boolean;
  world: WorldState;
  onClose: () => void;
  onContribute: (projectId: string, itemId: PersonalItemId, amount: number) => void;
}

/**
 * Everyday Gameplay GA-5 — Community Contribution Shelf (plaza noticeboard sheet).
 *
 * Pure view of `getCommunityProjectsView(world)`: the panel never calls reducers
 * itself — contribution taps dispatch `onContribute` and App owns the reducer,
 * world commit, toast, and memory chime. Refusal prose arrives back through the
 * normal toast channel, so the panel holds no local state.
 *
 * Styling mirrors GreenhousePanel's linen card language — Fraunces headings,
 * warm stone borders, hand-rolled palette progress bars, >= 44px touch targets,
 * and NO backdrop-filter over the WebGL canvas.
 */
export const CommunityProjectsPanel: React.FC<CommunityProjectsPanelProps> = ({
  open,
  world,
  onClose,
  onContribute,
}) => {
  const projects = useMemo(() => getCommunityProjectsView(world), [world]);

  const totals = useMemo(
    () =>
      projects.reduce(
        (acc, p) => ({
          contributed: acc.contributed + p.totalContributed,
          goal: acc.goal + p.totalGoal,
          completed: acc.completed + (p.completed ? 1 : 0),
        }),
        { contributed: 0, goal: 0, completed: 0 },
      ),
    [projects],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-espresso/45 pointer-events-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Community Contribution Shelf"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] bg-linen border border-stone-line rounded-2xl shadow-elevation-drawer flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-espresso leading-tight">
              Community Contribution Shelf
            </h2>
            <p className="text-xs text-espresso-muted mt-0.5 leading-snug">
              Village Noticeboard · Shared endeavors, tended at your own pace
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close community shelf panel"
            className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fixed summary strip — totals across every open shelf */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#EFE5D6] flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex flex-wrap items-center gap-1 px-2.5 py-1.5 rounded-lg bg-linen-deep text-[#4E4036] font-medium">
            <Users className="w-3.5 h-3.5 text-terracotta shrink-0" />
            <span>
              <span className="font-mono-nums">{totals.contributed}</span> of{' '}
              <span className="font-mono-nums">{totals.goal}</span> strands gathered across town
            </span>
          </span>
          {totals.completed > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EEF3EC] text-[#3E5A44] font-semibold">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-nums">{totals.completed}</span>{' '}
              {totals.completed === 1 ? 'shelf' : 'shelves'} finished
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto storybook-scroll max-h-[70vh] p-4 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-umber leading-relaxed">
            Leave pocket finds in the neighborhood baskets for shared town endeavors — every
            blossom, apple, and little treasure is logged on the noticeboard. No deadlines, no
            hurry: the shelves wait as long as they need to.
          </p>

          {projects.map((project) => (
            <article
              key={project.id}
              className={`p-3.5 sm:p-4 rounded-xl border space-y-2.5 ${
                project.completed ? 'bg-[#EEF3EC] border-[#A7C0A8]' : 'bg-card-warm border-parchment'
              }`}
            >
              {/* Title + venue chip */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-espresso min-w-0 leading-snug">
                  {project.title}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-linen-deep text-[#4E4036] font-medium text-xs shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-terracotta shrink-0" />
                  {project.venueLabel}
                </span>
              </div>

              <p className="text-xs text-espresso-muted leading-relaxed">{project.blurb}</p>

              {/* Warm completed banner replaces the contribute controls */}
              {project.completed && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#3E5A44] bg-[#F3F5EE] border border-[#CEDAC8] rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 shrink-0" />
                  Finished on Day <span className="font-mono-nums">{project.completedDay}</span> —
                  take a walk past the plaza lamps!
                </p>
              )}

              {/* Item rows: satchel count, hand-rolled progress, contribute controls */}
              <div className="space-y-2">
                {project.items.map((item) => {
                  const have = getItemCount(world.inventory, item.itemId);
                  const remaining = Math.max(0, item.goal - item.contributed);
                  const allAmount = Math.min(have, remaining);
                  const canContributeOne = !project.completed && have >= 1 && remaining >= 1;
                  const showContributeAll = !project.completed && have > 1 && remaining > 1;
                  const pct = item.goal > 0
                    ? Math.min(100, Math.round((item.contributed / item.goal) * 100))
                    : 0;

                  return (
                    <div
                      key={item.itemId}
                      className="rounded-lg bg-linen border border-[#E5D9C7] p-2.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-espresso">{item.label}</span>
                        <span className="text-[11px] text-espresso-muted font-mono-nums">
                          have in satchel: {have}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-2 flex-1 rounded-full bg-parchment overflow-hidden"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={item.goal}
                          aria-valuenow={item.contributed}
                          aria-label={`${item.label}: ${item.contributed} of ${item.goal} gathered`}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] ${
                              item.met ? 'bg-sage' : 'bg-honey'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono-nums text-xs font-semibold shrink-0 ${
                            item.met ? 'text-[#4B6B4F]' : 'text-espresso'
                          }`}
                        >
                          {item.contributed}/{item.goal}
                        </span>
                      </div>

                      {!project.completed && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!canContributeOne}
                            onClick={() => onContribute(project.id, item.itemId, 1)}
                            aria-label={`Contribute one ${item.label} to ${project.title}`}
                            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                              canContributeOne
                                ? 'bg-sage hover:bg-[#4F6E53] text-linen cursor-pointer'
                                : 'bg-[#E6DAC7] text-[#8C7D6F] cursor-not-allowed'
                            }`}
                          >
                            Contribute 1
                          </button>
                          {showContributeAll && (
                            <button
                              type="button"
                              onClick={() => onContribute(project.id, item.itemId, allAmount)}
                              aria-label={`Contribute all ${allAmount} ${item.label} to ${project.title}`}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-linen hover:bg-[#EFE5D5] border border-stone-line text-xs sm:text-sm font-semibold text-espresso transition-colors cursor-pointer"
                            >
                              Contribute all (
                              <span className="font-mono-nums">{allAmount}</span>)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
