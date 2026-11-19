import React, { useMemo, useState } from 'react';
import { Gift, PackageOpen, Sparkles, X } from 'lucide-react';
import {
  PERSONAL_ITEMS,
  PERSONAL_ITEM_CATEGORY_LABELS,
  getItemCount,
  getTotalItemCount,
} from '../game/inventory';
import {
  PersonalItemCategory,
  PersonalItemDef,
  PlayerLocation,
  WorldState,
} from '../game/types';

export type CottageStationMode = 'hearth' | 'vase' | 'shelf';

interface InventoryDrawerProps {
  open: boolean;
  world: WorldState;
  playerLocation: PlayerLocation;
  onClose: () => void;
  onOpenCottageStation?: (mode: CottageStationMode) => void;
}

type CategoryFilter = 'all' | PersonalItemCategory;

const FILTER_TABS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'flora_ingredient', label: 'Flora' },
  { id: 'baked_treat', label: 'Baked' },
  { id: 'field_find', label: 'Finds' },
  { id: 'keepsake', label: 'Keepsakes' },
];

export const InventoryDrawer: React.FC<InventoryDrawerProps> = ({
  open,
  world,
  playerLocation,
  onClose,
  onOpenCottageStation,
}) => {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const ownedItems = useMemo(() => {
    const rows: Array<{ def: PersonalItemDef; count: number }> = [];
    for (const def of PERSONAL_ITEMS) {
      const count = getItemCount(world.inventory, def.id);
      if (count <= 0) continue;
      if (filter !== 'all' && def.category !== filter) continue;
      rows.push({ def, count });
    }
    return rows;
  }, [world.inventory, filter]);

  if (!open) return null;

  const discoveredCount = world.discoveredItemIds?.length ?? 0;
  const totalCarried = getTotalItemCount(world.inventory);
  const isIndoors = playerLocation === 'cottage_interior';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-[#2D241E]/45 pointer-events-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Personal Satchel & Keepsakes"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] bg-[#FAF5EC] border border-[#D4C4AE] rounded-2xl shadow-[0_20px_56px_rgba(45,36,30,0.28)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2D241E] leading-tight">
              Satchel &amp; Keepsakes
            </h2>
            <p className="text-xs text-[#6A5B50] mt-0.5 leading-snug">
              <span className="font-mono-nums">{totalCarried}</span>{' '}
              {totalCarried === 1 ? 'item' : 'items'} carried ·{' '}
              <span className="font-mono-nums">
                {discoveredCount}/{PERSONAL_ITEMS.length}
              </span>{' '}
              discovered
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close satchel"
            className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-[#6A5B50] hover:bg-[#EFE5D5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filters */}
        <div
          role="tablist"
          aria-label="Satchel categories"
          className="px-3 sm:px-5 py-2.5 border-b border-[#EFE5D6] flex items-center gap-1.5 overflow-x-auto"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[44px] min-w-[44px] px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#C86446] text-[#FAF5EC]'
                    : 'bg-[#F1E8D9] text-[#4E4036] hover:bg-[#E7DAC5]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto storybook-scroll p-4 sm:p-5 space-y-3">
          {ownedItems.length === 0 ? (
            <div className="p-5 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] text-center space-y-2">
              <PackageOpen className="w-6 h-6 text-[#8C7D6F] mx-auto" />
              <p className="text-sm font-medium text-[#2D241E]">
                Nothing tucked under this pocket right now.
              </p>
              <p className="text-xs text-[#5E5046] max-w-md mx-auto leading-relaxed">
                Gather blossoms from your cottage window box, clip herbs by Sunbeam Greenhouse,
                harvest Fern Hollow Orchard, or walk Mirror Pond’s reed bank.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ownedItems.map(({ def, count }) => {
                const isDisplayedOnShelf =
                  def.homeDisplayable === 'shelf' &&
                  Boolean(world.cottageState?.displayedKeepsakeIds?.includes(def.id));

                let stationAction: { label: string; mode: CottageStationMode } | null = null;
                if (isIndoors && onOpenCottageStation) {
                  if (def.homeDisplayable === 'vase') {
                    stationAction = { label: 'Arrange in Vase', mode: 'vase' };
                  } else if (def.homeDisplayable === 'shelf') {
                    stationAction = { label: 'Shelf Arrangement', mode: 'shelf' };
                  } else if (def.category === 'flora_ingredient') {
                    stationAction = { label: 'Use at Hearth', mode: 'hearth' };
                  }
                }

                return (
                  <article
                    key={def.id}
                    className="p-3.5 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-[#2D241E] leading-snug">
                            {def.label}
                          </h3>
                          <p className="text-[11px] font-medium text-[#6A5B50]">
                            {PERSONAL_ITEM_CATEGORY_LABELS[def.category]}
                          </p>
                        </div>
                        <span className="font-mono-nums text-xs font-bold px-2 py-0.5 rounded-lg bg-[#FAF5EC] border border-[#D4C4AE] text-[#2D241E] shrink-0">
                          ×{count}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#4A3C32] leading-relaxed">
                        {def.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#E5D9C7] flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#5E5046] flex items-center gap-1">
                        {def.category === 'keepsake' ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#5E8062] shrink-0" />
                            <span>
                              {isDisplayedOnShelf ? 'On your cottage shelf' : 'Cottage shelf keepsake'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Gift className="w-3.5 h-3.5 text-[#C86446] shrink-0" />
                            <span>
                              {def.homeDisplayable === 'vase'
                                ? 'Giftable · Fits table vase'
                                : 'Giftable to neighbors'}
                            </span>
                          </>
                        )}
                      </span>

                      {stationAction && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenCottageStation?.(stationAction!.mode);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#FAF5EC] hover:bg-[#EFE5D5] border border-[#D4C4AE] text-xs font-semibold text-[#2D241E] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {stationAction.label}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
