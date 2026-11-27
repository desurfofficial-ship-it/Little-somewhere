import React, { useEffect, useRef, useState } from 'react';
import { Check, Flame, Flower2, Frame, Sparkles, X } from 'lucide-react';
import {
  HEARTH_RECIPES,
  PERSONAL_ITEM_MAP,
  canCraftRecipe,
  getItemCount,
  getOwnedKeepsakeItems,
  getOwnedVaseFlowerItems,
  getRecipeActivitySteps,
  isRecipeDiscovered,
} from '../game/inventory';
import { describePlacedFlower } from '../game/cottage';
import { cozyAudio } from '../game/audio';
import { PersonalItemId, WorldState } from '../game/types';
import { CottageStationMode } from './InventoryDrawer';
import { useDialogA11y } from './useDialogA11y';

interface CottageStationModalProps {
  mode: CottageStationMode | null;
  world: WorldState;
  onChangeMode: (mode: CottageStationMode) => void;
  onClose: () => void;
  onCookRecipe: (recipeId: string) => void;
  onPlaceFlower: (flowerId: PersonalItemId | null) => void;
  onToggleKeepsake: (keepsakeId: PersonalItemId) => void;
}

const STATION_TABS: ReadonlyArray<{
  id: CottageStationMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'hearth', label: 'Hearth & Kettle', Icon: Flame },
  { id: 'vase', label: 'Table Vase', Icon: Flower2 },
  { id: 'shelf', label: 'Keepsake Shelf', Icon: Frame },
];

export const CottageStationModal: React.FC<CottageStationModalProps> = ({
  mode,
  world,
  onChangeMode,
  onClose,
  onCookRecipe,
  onPlaceFlower,
  onToggleKeepsake,
}) => {
  // Hearth preparation moment: three short sensory steps, then the reducer commits
  // once and a completion card names what was made. Closing mid-activity cancels.
  const [brewSteps, setBrewSteps] = useState<{ recipeId: string; stepIndex: number } | null>(null);
  const [brewComplete, setBrewComplete] = useState<{
    recipeId: string;
    outputLabel: string;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    if (!brewSteps) return;
    const recipe = HEARTH_RECIPES.find((r) => r.id === brewSteps.recipeId);
    if (!recipe) {
      setBrewSteps(null);
      return;
    }
    if (brewSteps.stepIndex >= getRecipeActivitySteps(recipe.id).length) {
      onCookRecipe(recipe.id);
      const outDef = PERSONAL_ITEM_MAP[recipe.outputItemId];
      setBrewComplete({
        recipeId: recipe.id,
        outputLabel: outDef?.label ?? recipe.label,
        minutes: recipe.minutesRequired,
      });
      setBrewSteps(null);
      return;
    }
    const t = window.setTimeout(() => {
      setBrewSteps((s) => (s ? { ...s, stepIndex: s.stepIndex + 1 } : s));
    }, 640);
    return () => window.clearTimeout(t);
  }, [brewSteps, onCookRecipe]);

  useEffect(() => {
    if (!brewComplete) return;
    const t = window.setTimeout(() => setBrewComplete(null), 3400);
    return () => window.clearTimeout(t);
  }, [brewComplete]);

  const brewing = brewSteps !== null;

  // UI/UX program (WP3): shared focus kit. Declared BEFORE the early return so
  // hook order stays stable across open/close.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogA11y(dialogRef, Boolean(mode));

  if (!mode) return null;

  const cottage = world.cottageState;
  const vaseFlowers = getOwnedVaseFlowerItems(world.inventory);
  const ownedKeepsakes = getOwnedKeepsakeItems(world.inventory);
  const displayedIds = cottage?.displayedKeepsakeIds ?? [];

  const title =
    mode === 'hearth'
      ? 'Copper Kettle & Stone Hearth'
      : mode === 'vase'
      ? 'Oak Table & Stoneware Vase'
      : 'Oak Keepsake Display Shelf';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-espresso/45 pointer-events-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[85vh] bg-linen border border-stone-line rounded-2xl shadow-elevation-drawer flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-espresso leading-tight">
              {title}
            </h2>
            <p className="text-xs text-espresso-muted mt-0.5 leading-snug">
              Willow Step Cottage · Tended at your own pace
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cottage station"
            className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Station Tabs */}
        <div
          role="tablist"
          aria-label="Cottage home stations"
          className="px-3 sm:px-5 py-2.5 border-b border-[#EFE5D6] flex items-center gap-1.5 overflow-x-auto"
        >
          {STATION_TABS.map((t) => {
            const Icon = t.Icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeMode(t.id)}
                className={`min-h-[44px] px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-terracotta-deep text-linen'
                    : 'bg-linen-deep text-[#4E4036] hover:bg-[#E7DAC5]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div tabIndex={0} className="flex-1 overflow-y-auto storybook-scroll p-4 sm:p-5 space-y-3.5">
          {mode === 'hearth' && (
            <>
              <p className="text-xs sm:text-sm text-umber leading-relaxed">
                Steep tea or bake warm treats with blossoms, herbs, orchard apples, and honey.
                Neighbors love sharing something freshly made from your hearth.
              </p>
              <div className="space-y-3">
                {HEARTH_RECIPES.map((recipe) => {
                  const discovered = isRecipeDiscovered(world.sideFlags, recipe);
                  const craftable = discovered && canCraftRecipe(world.inventory, recipe);
                  const ownedOut = getItemCount(world.inventory, recipe.outputItemId);
                  return (
                    <article
                      key={recipe.id}
                      className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        discovered
                          ? 'bg-card-warm border-parchment'
                          : 'bg-linen-deep border-dashed border-stone-line'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h3 className="font-display text-base font-semibold text-espresso">
                            {discovered ? recipe.label : 'Undiscovered Recipe'}
                          </h3>
                          {discovered && ownedOut > 0 && (
                            <span className="text-[11px] font-mono-nums text-sage font-semibold">
                              In satchel: {ownedOut}
                            </span>
                          )}
                        </div>
                        {discovered ? (
                          <>
                            <p className="text-xs text-[#4A3C32] leading-relaxed">
                              {recipe.description}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-xs">
                              {recipe.ingredients.map((ing) => {
                                const have = getItemCount(world.inventory, ing.itemId);
                                const enough = have >= ing.count;
                                return (
                                  <span
                                    key={ing.itemId}
                                    className={`font-medium ${
                                      enough ? 'text-[#4B6B4F]' : 'text-[#8C5B4D]'
                                    }`}
                                  >
                                    {PERSONAL_ITEM_MAP[ing.itemId].label}:{' '}
                                    <span className="font-mono-nums">
                                      {have}/{ing.count}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-[#8C7D6F] italic leading-relaxed">
                            {recipe.discoverHint ?? 'Discover this recipe through exploration.'}
                          </p>
                        )}
                      </div>

                      {discovered && (
                        <button
                          type="button"
                          disabled={!craftable || brewing}
                          onClick={() => {
                            if (!craftable || brewing) return;
                            setBrewComplete(null);
                            setBrewSteps({ recipeId: recipe.id, stepIndex: 0 });
                            cozyAudio.playKettleSteam();
                          }}
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            craftable && !brewing
                              ? 'bg-terracotta hover:bg-terracotta-deep text-linen cursor-pointer'
                              : 'bg-[#E6DAC7] text-[#8C7D6F] cursor-not-allowed'
                          }`}
                        >
                          {brewing && brewSteps?.recipeId === recipe.id
                            ? 'Preparing…'
                            : recipe.id === 'recipe_chamomile_tea'
                            ? 'Steep Tea'
                            : 'Bake Treat'}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {mode === 'vase' && (
            <>
              <div className="p-4 rounded-xl bg-card-warm border border-parchment flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-espresso">
                    Centerpiece Right Now
                  </h3>
                  <p className="text-xs sm:text-sm text-[#4A3C32] mt-1 leading-relaxed">
                    {describePlacedFlower(cottage?.placedFlowerId ?? null)}
                  </p>
                </div>
                {cottage?.placedFlowerId && (
                  <button
                    type="button"
                    onClick={() => onPlaceFlower(null)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-linen hover:bg-[#EFE5D5] border border-stone-line text-xs sm:text-sm font-semibold text-espresso transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Return to Satchel
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                <h3 className="font-display text-base font-semibold text-espresso">
                  Blooms &amp; Boughs in Satchel
                </h3>
                {vaseFlowers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-card-warm border border-parchment text-xs sm:text-sm text-umber leading-relaxed">
                    Gather Chamomile Blossoms, Sweet Lavender, or Orchard Crabapples outside to arrange a fresh centerpiece on your oak table.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {vaseFlowers.map(({ def, count }) => (
                      <div
                        key={def.id}
                        className="p-3.5 rounded-xl bg-card-warm border border-parchment flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-display text-base font-semibold text-espresso">
                            {def.label}{' '}
                            <span className="font-mono-nums text-xs text-espresso-muted font-normal">
                              (×{count})
                            </span>
                          </div>
                          <p className="text-xs text-[#4A3C32] mt-0.5">{def.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onPlaceFlower(def.id)}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-sage-deep hover:bg-sage text-xs sm:text-sm font-semibold text-linen transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Arrange
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'shelf' && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs sm:text-sm text-umber leading-relaxed">
                  Special mementos shared by close neighbors can be set out along your sunlit oak shelf.
                </p>
                <span className="font-mono-nums text-xs font-semibold text-espresso-muted shrink-0">
                  {displayedIds.length}/5 Displayed
                </span>
              </div>

              {ownedKeepsakes.length === 0 ? (
                <div className="p-5 rounded-xl bg-card-warm border border-parchment text-center space-y-2">
                  <Sparkles className="w-5 h-5 text-[#8C7D6F] mx-auto" />
                  <p className="text-sm font-medium text-espresso">
                    No neighborhood keepsakes yet
                  </p>
                  <p className="text-xs text-umber max-w-md mx-auto leading-relaxed">
                    As friendships deepen with Pip, Toby, Mina, Arthur, and Barnaby—especially when sharing thoughtful gifts—they may press a handmade keepsake into your satchel.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {ownedKeepsakes.map((def) => {
                    const isDisplayed = displayedIds.includes(def.id);
                    return (
                      <article
                        key={def.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDisplayed
                            ? 'bg-[#EEF3EC] border-[#A7C0A8]'
                            : 'bg-card-warm border-parchment'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-base font-semibold text-espresso">
                              {def.label}
                            </h3>
                            {isDisplayed && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4B6B4F]">
                                <Check className="w-3.5 h-3.5" />
                                Displayed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#4A3C32] mt-0.5 leading-relaxed">
                            {def.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleKeepsake(def.id)}
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            isDisplayed
                              ? 'bg-linen hover:bg-[#EFE5D5] border border-stone-line text-espresso'
                              : 'bg-terracotta hover:bg-terracotta-deep text-linen'
                          }`}
                        >
                          {isDisplayed ? 'Tuck Away' : 'Set on Shelf'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Hearth activity overlay: staged preparation + completion card */}
        {(brewSteps || brewComplete) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-linen/94 p-5">
            {brewSteps ? (
              <div className="w-full max-w-sm text-center space-y-3" aria-live="polite">
                <Flame className="w-6 h-6 text-terracotta mx-auto animate-pulse" />
                <h3 className="font-display text-lg font-semibold text-espresso">
                  Hearth &amp; Kettle at work
                </h3>
                <div className="flex items-center justify-center gap-2" aria-hidden="true">
                  {getRecipeActivitySteps(brewSteps.recipeId).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                        idx <= brewSteps.stepIndex ? 'bg-terracotta' : 'bg-parchment'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-[#4A3C32] leading-relaxed min-h-[2.6em]">
                  {getRecipeActivitySteps(brewSteps.recipeId)[Math.min(brewSteps.stepIndex, 2)]}
                </p>
              </div>
            ) : (
              brewComplete && (
                <div className="w-full max-w-sm text-center space-y-2.5" aria-live="polite">
                  <Sparkles className="w-6 h-6 text-honey mx-auto" />
                  <h3 className="font-display text-lg font-semibold text-espresso">
                    {brewComplete.outputLabel}
                  </h3>
                  <p className="text-sm text-[#4A3C32] leading-relaxed">
                    Ready from your hearth — {brewComplete.minutes} minutes of gentle kitchen
                    quiet, tucked warm into your satchel.
                  </p>
                  <button
                    type="button"
                    onClick={() => setBrewComplete(null)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-terracotta hover:bg-terracotta-deep text-sm font-semibold text-linen transition-colors cursor-pointer"
                  >
                    Lovely — Done
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
