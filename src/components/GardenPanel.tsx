/**
 * Garden Panel — the outdoor garden interaction UI.
 *
 * Mirrors the GreenhousePanel pattern: a bottom sheet with planting, watering,
 * and harvesting controls for an outdoor garden bed. Driven by the gardenId
 * prop so it works for any registered garden.
 */
import React, { useMemo } from 'react';
import { Droplets, Leaf, Scissors, Sprout, X } from 'lucide-react';
import {
  GREENHOUSE_CROPS,
  isLushStreak,
} from '../game/greenhouse';
import {
  GARDENS,
  getGardenDef,
  getGardenState,
  summarizeGarden,
} from '../game/gardens';
import { PERSONAL_ITEM_MAP, getItemCount } from '../game/inventory';
import {
  GardenState,
  GreenhousePlotState,
  PersonalItemId,
  WorldState,
} from '../game/types';
import { useDialogA11y } from './useDialogA11y';

export interface GardenPanelProps {
  gardenId: string;
  world: WorldState;
  onClose: () => void;
  onPlantSeed: (gardenId: string, seedItemId: PersonalItemId, plotIndex: number) => void;
  onHarvestPlot: (gardenId: string, plotIndex: number) => void;
  onWaterAll: (gardenId: string) => void;
}

export function GardenPanel({
  gardenId,
  world,
  onClose,
  onPlantSeed,
  onHarvestPlot,
  onWaterAll,
}: GardenPanelProps) {
  const def = getGardenDef(gardenId);
  const panelRef = React.useRef<HTMLDialogElement>(null);
  useDialogA11y(panelRef, Boolean(def));

  const state = useMemo(() => {
    if (!def) return null;
    // DEFECT-9 fix: use read-only getGardenState, NOT getOrCreateGardenState
    // (which mutates world.gardens inside useMemo — a React side-effect).
    return getGardenState(world, gardenId);
  }, [world, gardenId, def]);

  const summary = useMemo(() => summarizeGarden(state), [state]);

  // If the garden has no state yet (player hasn't interacted), show an empty
  // placeholder so the panel doesn't crash — the first planting will lazy-init.
  if (!def || !state) {
    if (!def) return null;
    // Garden exists in registry but has no state yet — show empty summary.
    return (
      <dialog
        ref={panelRef}
        className="fixed inset-x-0 bottom-0 z-50 w-full max-h-[75vh] overflow-y-auto rounded-t-3xl bg-linen/95 backdrop-blur-sm border-t-2 border-stone-line shadow-2xl open:flex open:flex-col"
        style={{ display: 'flex' }}
        aria-label={def.label}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-line/50">
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-sage-deep" />
            <h2 className="font-display text-lg sm:text-xl text-espresso">{def.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-linen-deep transition-colors"
            aria-label="Close garden panel"
          >
            <X className="w-5 h-5 text-espresso-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <p className="text-sm text-espresso-muted leading-relaxed">{def.blurb}</p>
          <p className="text-xs text-espresso-muted italic">
            {def.plotCount} empty {def.plotCount > 1 ? 'plots' : 'plot'} wait{def.plotCount > 1 ? '' : 's'} for seeds. Plant a seed to begin.
          </p>
        </div>
      </dialog>
    );
  }

  const allowedCrops = def.allowedCropIds
    ? GREENHOUSE_CROPS.filter((c) => def.allowedCropIds!.includes(c.id))
    : GREENHOUSE_CROPS;

  // Resident-owned gardens: the NPC owner tends autonomously. The player may
  // co-tend by watering (free) but cannot plant (would waste seeds — NPC
  // composts the harvest) or harvest (ownership guard in the action rejects).
  const isResidentOwned = def.ownerId !== 'player' && def.ownerId !== 'community';

  // Seeds the player actually has in their satchel.
  const availableSeeds = allowedCrops.filter((c) => getItemCount(world.inventory, c.seedItemId) > 0);

  const emptyPlots = state.plots
    .map((plot, idx) => ({ plot, idx }))
    .filter(({ plot }) => !plot.cropId);

  const readyPlots = state.plots
    .map((plot, idx) => ({ plot, idx }))
    .filter(({ plot }) => plot.cropId && plot.stage >= 3);

  const thirstyPlots = state.plots
    .map((plot, idx) => ({ plot, idx }))
    .filter(({ plot }) => plot.cropId && plot.stage < 3 && !plot.wateredToday);

  return (
    <dialog
      ref={panelRef}
      className="fixed inset-x-0 bottom-0 z-50 w-full max-h-[75vh] overflow-y-auto rounded-t-3xl bg-linen/95 backdrop-blur-sm border-t-2 border-stone-line shadow-2xl open:flex open:flex-col"
      style={{ display: def ? 'flex' : 'none' }}
      aria-label={def.label}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-line/50">
        <div className="flex items-center gap-2">
          <Sprout className="w-5 h-5 text-sage-deep" />
          <h2 className="font-display text-lg sm:text-xl text-espresso">{def.label}</h2>
          {isResidentOwned && (
            <span className="px-2 py-0.5 rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta">
              Resident's bed
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-linen-deep transition-colors"
          aria-label="Close garden panel"
        >
          <X className="w-5 h-5 text-espresso-muted" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Garden description */}
        <p className="text-sm text-espresso-muted leading-relaxed">{def.blurb}</p>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-sage-deep/15 text-xs font-semibold text-sage-deep">
            {summary.emptyPlots} empty
          </span>
          {summary.growingPlots > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-honey/15 text-xs font-semibold text-amber-honey">
              {summary.growingPlots} growing
            </span>
          )}
          {summary.thirstyPlots > 0 && (
            <span className="px-3 py-1 rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta">
              {summary.thirstyPlots} thirsty
            </span>
          )}
          {summary.readyPlots > 0 && (
            <span className="px-3 py-1 rounded-full bg-sage-deep/25 text-xs font-semibold text-sage-deep">
              {summary.readyPlots} ready
            </span>
          )}
        </div>

        {/* Plot list */}
        <div className="space-y-2">
          {state.plots.map((plot, idx) => (
            <PlotRow
              key={idx}
              plot={plot}
              plotIndex={idx}
              gardenId={gardenId}
              onHarvest={onHarvestPlot}
              isResidentOwned={isResidentOwned}
            />
          ))}
        </div>

        {/* Watering action */}
        {thirstyPlots.length > 0 && (
          <button
            type="button"
            onClick={() => onWaterAll(gardenId)}
            className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-sage-deep hover:bg-sage text-linen text-sm font-semibold transition-colors"
          >
            <Droplets className="w-4 h-4" />
            {world.weather === 'light_rain' ? 'Water all thirsty plots (rain helps — free!)' : 'Water all thirsty plots (+8m)'}
          </button>
        )}

        {/* Planting section — hidden for resident-owned gardens (player cannot harvest there) */}
        {!isResidentOwned && emptyPlots.length > 0 && availableSeeds.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-espresso-muted uppercase tracking-wide">
              Plant a seed
            </h3>
            {emptyPlots.map(({ idx }) => (
              <div key={idx} className="space-y-1">
                <p className="text-xs text-espresso-muted">Plot {idx + 1} — empty</p>
                <div className="flex flex-wrap gap-2">
                  {availableSeeds.map((crop) => (
                    <button
                      key={crop.id}
                      type="button"
                      onClick={() => onPlantSeed(gardenId, crop.seedItemId, idx)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sage-deep/15 hover:bg-sage-deep/25 text-xs sm:text-sm font-semibold text-espresso transition-colors"
                    >
                      <Sprout className="w-3.5 h-3.5 inline mr-1 text-sage-deep" />
                      {crop.label}
                      <span className="ml-1 text-espresso-muted">
                        ({getItemCount(world.inventory, crop.seedItemId)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {emptyPlots.length > 0 && availableSeeds.length === 0 && (
          <p className="text-xs text-espresso-muted italic">
            No sowable seeds in your satchel. Harvest existing plants or find new seeds around the neighborhood.
          </p>
        )}
      </div>
    </dialog>
  );
}

/** A single plot row with state label and harvest button. */
function PlotRow({
  plot,
  plotIndex,
  gardenId,
  onHarvest,
  isResidentOwned,
}: {
  plot: GreenhousePlotState;
  plotIndex: number;
  gardenId: string;
  onHarvest: (gardenId: string, plotIndex: number) => void;
  isResidentOwned: boolean;
}) {
  const cropDef = plot.cropId
    ? GREENHOUSE_CROPS.find((c) => c.id === plot.cropId)
    : null;
  const lush = isLushStreak(plot.waterStreak ?? 0);
  const isReady = plot.cropId && plot.stage >= 3;
  const isGrowing = plot.cropId && plot.stage < 3;

  return (
    <div className="flex items-center justify-between rounded-xl bg-linen-deep px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-linen">
          {isReady ? (
            <Leaf className="w-4 h-4 text-sage-deep" />
          ) : isGrowing ? (
            <Sprout className="w-4 h-4 text-honey" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-stone-line" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-espresso">
            Plot {plotIndex + 1}
          </p>
          <p className="text-xs text-espresso-muted">
            {!plot.cropId
              ? 'Empty'
              : isReady
              ? `${cropDef?.label ?? 'Plant'} — ready${lush ? ' (lush!)' : ''}`
              : `${cropDef?.label ?? 'Growing'} — stage ${plot.stage}${plot.wateredToday ? '' : ', thirsty'}`}
          </p>
        </div>
      </div>
      {isReady && !isResidentOwned && (
        <button
          type="button"
          onClick={() => onHarvest(gardenId, plotIndex)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sage-deep hover:bg-sage text-linen text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <Scissors className="w-3.5 h-3.5" />
          Harvest
        </button>
      )}
      {isReady && isResidentOwned && (
        <span className="text-xs text-espresso-muted italic px-2">
          Tended by the owner
        </span>
      )}
    </div>
  );
}
