import React, { useMemo } from 'react';
import { Droplets, Leaf, Scissors, Sprout, X } from 'lucide-react';
import {
  GREENHOUSE_CROPS,
  describeCareStreak,
  getGreenhouseCrop,
  isLushStreak,
  summarizeGreenhousePlots,
} from '../game/greenhouse';
import { PERSONAL_ITEM_MAP } from '../game/inventory';
import { GreenhouseState, WorldState } from '../game/types';

export type GreenhousePanelMode = 'planting' | 'harvest';

interface GreenhousePanelProps {
  mode: GreenhousePanelMode | null;
  world: WorldState;
  onClose: () => void;
  onPlantSeed: (
    seedItemId: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds' | 'foxglove_seeds',
    plotIndex: number,
  ) => void;
  onHarvestPlot: (plotIndex: number) => void;
  onWaterAll: () => void;
}

const PLOT_STAGE_LABELS = ['Newly sown', 'Sprouting', 'Leafy & growing', 'Ready to harvest'] as const;

/**
 * Sunbeam Greenhouse station panel (Milestone 3 Build 6): the sowing board at the potting
 * bench and the harvest list on the growing shelf. Follows the CottageStationModal linen
 * card language — Fraunces headings, warm borders, >= 44px touch targets.
 */
export const GreenhousePanel: React.FC<GreenhousePanelProps> = ({
  mode,
  world,
  onClose,
  onPlantSeed,
  onHarvestPlot,
  onWaterAll,
}) => {
  const gh: GreenhouseState = useMemo(
    () => world.greenhouseState ?? { plots: [], noteReadDay: 0, totalHarvests: 0, totalPlanted: 0 },
    [world.greenhouseState],
  );
  const summary = useMemo(() => summarizeGreenhousePlots(gh), [gh]);

  const ownedSeeds = useMemo(
    () =>
      GREENHOUSE_CROPS.map((crop) => ({
        crop,
        count: world.inventory?.[crop.seedItemId] ?? 0,
      })).filter((row) => row.count > 0),
    [world.inventory],
  );

  if (!mode) return null;

  const title =
    mode === 'planting' ? 'Potting Bench & Seed Drawers' : 'Growing Shelf Harvest';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-espresso/45 pointer-events-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] bg-linen border border-stone-line rounded-2xl shadow-elevation-drawer flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-espresso leading-tight">
              {title}
            </h2>
            <p className="text-xs text-espresso-muted mt-0.5 leading-snug">
              Sunbeam Greenhouse · Mina's shared growing corner
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close greenhouse panel"
            className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shared plot overview */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#EFE5D6] flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-linen-deep text-[#4E4036] font-medium">
            <Sprout className="w-3.5 h-3.5 text-sage shrink-0" />
            <span className="font-mono-nums">{summary.growingPlots}</span> growing
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-linen-deep text-[#4E4036] font-medium">
            <Scissors className="w-3.5 h-3.5 text-terracotta shrink-0" />
            <span className="font-mono-nums">{summary.readyPlots}</span> ready
          </span>
          {summary.thirstyPlots > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EAF0EA] text-[#3E5A44] font-semibold">
              <Droplets className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-nums">{summary.thirstyPlots}</span> thirsty
            </span>
          )}
          <span className="ml-auto text-espresso-muted">
            Season: <span className="font-semibold capitalize">{world.season}</span>
            {world.season === 'winter' && ' · pots rest until spring'}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto storybook-scroll p-4 sm:p-5 space-y-3">
          {/* Everyday Gameplay GA-2 — rain-day hint: the rain chain waters for you. */}
          {world.weather === 'light_rain' && (
            <p className="text-xs sm:text-sm font-medium text-[#3E5A44] bg-[#EAF0EA] border border-[#A7C0A8] rounded-lg px-3.5 py-2.5">
              Rain today — the rain chain is carrying the watering for you.
            </p>
          )}

          {mode === 'planting' && (
            <>
              <p className="text-xs sm:text-sm text-umber leading-relaxed">
                Tuck a seed fold into an empty terracotta pot. A freshly sown pot is watered the
                same evening — after that, water it once a day at the rain barrel and it grows a
                little every night. A seed always comes back with the harvest.
              </p>

              {ownedSeeds.length === 0 ? (
                <div className="p-5 rounded-xl bg-card-warm border border-parchment text-center space-y-2">
                  <Leaf className="w-6 h-6 text-[#8C7D6F] mx-auto" />
                  <p className="text-sm font-medium text-espresso">No seed folds in your satchel</p>
                  <p className="text-xs text-umber max-w-md mx-auto leading-relaxed">
                    Read Mina's planting notes on the worktable — she keeps a starter packet of
                    chamomile and thyme seeds beside them. Harvests also return one seed fold for
                    the next sowing.
                  </p>
                </div>
              ) : (
                ownedSeeds.map(({ crop, count }) => {
                  const emptyPlots = gh.plots
                    .map((plot, idx) => ({ plot, idx }))
                    .filter(({ plot }) => !plot.cropId);
                  return (
                    <article
                      key={crop.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-card-warm border border-parchment space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-espresso">
                            {PERSONAL_ITEM_MAP[crop.seedItemId].label}{' '}
                            <span className="font-mono-nums text-xs text-espresso-muted font-normal">
                              (×{count})
                            </span>
                          </h3>
                          <p className="text-xs text-[#4A3C32] mt-0.5 leading-relaxed">{crop.blurb}</p>
                        </div>
                      </div>
                      {emptyPlots.length === 0 ? (
                        <p className="text-xs font-medium text-[#8C5B4D] bg-linen border border-[#E5D9C7] rounded-lg px-3 py-2">
                          All four pots are taken — harvest something on the growing shelf first.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {emptyPlots.map(({ idx }) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onPlantSeed(crop.seedItemId, idx)}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sage hover:bg-[#4F6E53] text-xs sm:text-sm font-semibold text-linen transition-colors cursor-pointer"
                            >
                              Sow in Pot {idx + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </>
          )}

          {mode === 'harvest' && (
            <>
              {summary.readyPlots === 0 ? (
                <div className="p-5 rounded-xl bg-card-warm border border-parchment text-center space-y-2">
                  <Sprout className="w-6 h-6 text-[#8C7D6F] mx-auto" />
                  <p className="text-sm font-medium text-espresso">Nothing is ready just yet</p>
                  <p className="text-xs text-umber max-w-md mx-auto leading-relaxed">
                    Keep watering at the rain barrel each day — watered pots grow one bright step
                    every night until they are ready for a gentle harvest.
                  </p>
                </div>
              ) : (
                gh.plots.map((plot, idx) => {
                  if (!plot.cropId || plot.stage < 3) return null;
                  const crop = getGreenhouseCrop(plot.cropId);
                  if (!crop) return null;
                  return (
                    <article
                      key={idx}
                      className="p-3.5 sm:p-4 rounded-xl bg-[#EEF3EC] border border-[#A7C0A8] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-display text-base font-semibold text-espresso">
                          Pot {idx + 1} · {crop.label}
                        </h3>
                        <p className="text-xs text-[#4A3C32] leading-relaxed">{crop.blurb}</p>
                        <p className="text-xs font-semibold text-[#3E5A44]">
                          Yields {PERSONAL_ITEM_MAP[crop.cropItemId].label} ×
                          <span className="font-mono-nums">{crop.harvestCount}</span> + one seed fold
                          back
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onHarvestPlot(idx)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-terracotta hover:bg-terracotta-deep text-xs sm:text-sm font-semibold text-linen transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Harvest Gently
                      </button>
                    </article>
                  );
                })
              )}

              {summary.growingPlots > 0 && (
                <div className="pt-1 space-y-2">
                  <h3 className="font-display text-sm font-semibold text-espresso">Still growing</h3>
                  {gh.plots.map((plot, idx) => {
                    if (!plot.cropId || plot.stage >= 3) return null;
                    const crop = getGreenhouseCrop(plot.cropId);
                    const lushStreak = isLushStreak(plot.waterStreak);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-card-warm border border-parchment space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-espresso font-medium">
                            Pot {idx + 1} · {crop?.label ?? 'Seedling'} — {PLOT_STAGE_LABELS[plot.stage]}
                            {!plot.wateredToday && ' · thirsty today'}
                          </span>
                          <span className="text-espresso-muted font-mono-nums shrink-0">
                            {plot.nightsGrown}/{crop?.growthNights ?? '?'} nights
                          </span>
                        </div>
                        {/* Everyday Gameplay GA-2 — per-plot care streak line
                           (sage when the lush streak has ripened, muted otherwise). */}
                        <p
                          className={`leading-snug ${
                            lushStreak
                              ? 'text-sage font-semibold'
                              : 'text-espresso-muted'
                          }`}
                        >
                          {describeCareStreak(plot.waterStreak)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
