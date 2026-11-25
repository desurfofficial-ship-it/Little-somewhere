import React, { useMemo, useRef } from 'react';
import { Aperture, Camera, Check, ImageIcon, MapPin, X } from 'lucide-react';
import { PHOTO_SUBJECTS, PhotoSubjectDef, getPhotoSubjectDef } from '../game/photography';
import { WorldState } from '../game/types';
import { useDialogA11y } from './useDialogA11y';

export type PhotoPanelMode = null | 'viewfinder' | 'album';

interface PhotoPanelProps {
  mode: PhotoPanelMode;
  world: WorldState;
  playerPos: { x: number; z: number };
  onClose: () => void;
  onCapture: (subjectId: string) => void;
  onSwitchMode: (mode: PhotoPanelMode) => void;
}

/**
 * Photography panel — the camera's viewfinder + album surface (Stage 3 Cont.).
 *
 * Pure view of `PHOTO_SUBJECTS` filtered by Euclidean distance from the player
 * to each subject's anchor against its `frameRadius`. The panel never calls
 * reducers itself — capture taps dispatch `onCapture(subjectId)` and App owns
 * the reducer, world commit, toast, and memory chime. The panel holds no local
 * state beyond the active mode prop the parent passes back.
 *
 * Styling mirrors CommunityProjectsPanel's linen card language (Fraunces
 * headings, warm stone borders, >= 44px touch targets, no backdrop-filter over
 * the WebGL canvas). Captured subjects (those with `mem_photo_first_<id>` in
 * `world.memories`) display a 'Kept' badge in both modes.
 */

const CATEGORY_STYLE: Record<
  PhotoSubjectDef['category'],
  { label: string; swatch: string }
> = {
  landmark: { label: 'Landmark', swatch: '#C9A253' },
  community: { label: 'Community', swatch: '#A7C0A8' },
  water: { label: 'Quiet Water', swatch: '#7FB5C4' },
  scenery: { label: 'Scenery', swatch: '#9B8BC4' },
};

function distanceTo(
  pos: { x: number; z: number },
  anchor: { x: number; z: number },
): number {
  return Math.hypot(pos.x - anchor.x, pos.z - anchor.z);
}

function isSubjectCaptured(world: WorldState, subjectId: string): boolean {
  return world.memories.some((m) => m.id === `mem_photo_first_${subjectId}`);
}

export const PhotoPanel: React.FC<PhotoPanelProps> = ({
  mode,
  world,
  playerPos,
  onClose,
  onCapture,
  onSwitchMode,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const open = mode !== null;
  useDialogA11y(dialogRef, open);

  // Viewfinder: subjects within their frameRadius of the player's position,
  // sorted by distance (closest first). Recomputed on every world/playerPos
  // change so a step toward a subject surfaces it in the list live.
  const viewfinderSubjects = useMemo(() => {
    if (mode !== 'viewfinder') return [];
    return PHOTO_SUBJECTS.filter((s) => distanceTo(playerPos, { x: s.anchorX, z: s.anchorZ }) <= s.frameRadius).sort(
      (a, b) =>
        distanceTo(playerPos, { x: a.anchorX, z: a.anchorZ }) -
        distanceTo(playerPos, { x: b.anchorX, z: b.anchorZ }),
    );
  }, [mode, playerPos]);

  // Album: every subject the player has captured at least once, in registry
  // order. Sorted by category then name for a tidy album grid.
  const albumSubjects = useMemo(() => {
    if (mode !== 'album') return [];
    return PHOTO_SUBJECTS.filter((s) => isSubjectCaptured(world, s.id)).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
  }, [mode, world]);

  const capturedCount = useMemo(
    () => PHOTO_SUBJECTS.filter((s) => isSubjectCaptured(world, s.id)).length,
    [world],
  );

  if (!open || mode === null) return null;

  const ariaLabel =
    mode === 'viewfinder' ? 'Camera Viewfinder' : 'Photograph Album';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-espresso/45 pointer-events-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] bg-linen border border-stone-line rounded-2xl shadow-elevation-drawer flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-espresso leading-tight">
              {mode === 'viewfinder' ? 'Camera Viewfinder' : 'Photograph Album'}
            </h2>
            <p className="text-xs text-espresso-muted mt-0.5 leading-snug">
              {mode === 'viewfinder'
                ? 'Frame what you notice · no daily limit, no quota'
                : `${capturedCount} of ${PHOTO_SUBJECTS.length} subjects kept`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera panel"
            className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode switcher */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-[#EFE5D6] flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSwitchMode('viewfinder')}
            aria-pressed={mode === 'viewfinder'}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              mode === 'viewfinder'
                ? 'bg-sage-deep text-linen'
                : 'bg-linen-deep text-[#4E4036] hover:bg-[#EFE5D5]'
            }`}
          >
            <Camera className="w-4 h-4 shrink-0" />
            Viewfinder
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('album')}
            aria-pressed={mode === 'album'}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              mode === 'album'
                ? 'bg-sage-deep text-linen'
                : 'bg-linen-deep text-[#4E4036] hover:bg-[#EFE5D5]'
            }`}
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            Album
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto storybook-scroll max-h-[70vh] p-4 sm:p-6 space-y-4">
          {mode === 'viewfinder' && (
            <>
              <p className="text-xs sm:text-sm text-umber leading-relaxed">
                Walk close to a subject and tap <span className="font-semibold">Capture</span>. The
                viewfinder lists only what you can frame from where you stand.
              </p>
              {viewfinderSubjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D9C8AE] p-6 text-center text-espresso-muted text-sm">
                  <Aperture className="w-6 h-6 mx-auto mb-2 text-[#B79C73]" />
                  No subjects in frame from here — wander toward a landmark, water, or community spot.
                </div>
              ) : (
                viewfinderSubjects.map((subject) => {
                  const dist = distanceTo(playerPos, { x: subject.anchorX, z: subject.anchorZ });
                  const captured = isSubjectCaptured(world, subject.id);
                  const style = CATEGORY_STYLE[subject.category];
                  return (
                    <article
                      key={subject.id}
                      className="p-3.5 sm:p-4 rounded-xl border bg-card-warm border-parchment space-y-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex items-start gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: style.swatch }}
                          />
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-semibold text-espresso leading-snug">
                              {subject.name}
                            </h3>
                            <p className="text-[11px] text-espresso-muted uppercase tracking-wide">
                              {style.label}
                            </p>
                          </div>
                        </div>
                        {captured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF3EC] text-[#3E5A44] text-[11px] font-semibold shrink-0">
                            <Check className="w-3 h-3 shrink-0" />
                            Kept
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-espresso-muted leading-relaxed">
                        {subject.memorySummary}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-espresso-muted font-mono-nums">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {dist.toFixed(1)}u
                        </span>
                        <button
                          type="button"
                          onClick={() => onCapture(subject.id)}
                          aria-label={`Capture photograph of ${subject.name}`}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors bg-sage-deep hover:bg-sage text-linen cursor-pointer flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 shrink-0" />
                          {captured ? 'Capture again' : 'Capture'}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </>
          )}

          {mode === 'album' && (
            <>
              <p className="text-xs sm:text-sm text-umber leading-relaxed">
                Every photograph you've kept — first frames of the neighborhood's quiet views.
              </p>
              {albumSubjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D9C8AE] p-6 text-center text-espresso-muted text-sm">
                  <ImageIcon className="w-6 h-6 mx-auto mb-2 text-[#B79C73]" />
                  No photographs yet — open the Viewfinder and capture your first subject. Your very
                  first frame becomes a keepsake for the cottage shelf.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {albumSubjects.map((subject) => {
                    const style = CATEGORY_STYLE[subject.category];
                    return (
                      <article
                        key={subject.id}
                        className="p-3 rounded-xl border bg-linen border-[#E5D9C7] space-y-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: style.swatch }}
                          />
                          <div className="min-w-0">
                            <h3 className="font-display text-sm font-semibold text-espresso leading-snug">
                              {subject.name}
                            </h3>
                            <p className="text-[10px] text-espresso-muted uppercase tracking-wide">
                              {style.label}
                            </p>
                          </div>
                        </div>
                        <p className="text-[11px] text-espresso-muted leading-relaxed line-clamp-3">
                          {subject.memorySummary}
                        </p>
                      </article>
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

// Helper re-exported for callers/tests that want to look up a subject def by id.
export { getPhotoSubjectDef };
