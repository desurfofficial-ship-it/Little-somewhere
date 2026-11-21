import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Gift,
  Heart,
  HeartHandshake,
  History,
  Smile,
  Sparkles,
  Sprout,
  UserRound,
  X,
} from 'lucide-react';
import {
  CharacterEmotion,
  DialogueChoice,
  DialogueSession,
  PersonalItemId,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentProgress,
  StoryFlags,
  WorldState,
} from '../game/types';
import { isChoiceAvailable } from '../game/narrative';
import { resolvePortrait, resolveSubjectImage, subjectForItem } from '../game/dialogue/assets';
import { PortraitCanvas, SubjectCanvas, useDialogueVisualSize } from './DialogueVisuals';

/**
 * BUILD 04 a11y floor (Doc 08 §7.5): the five DialogueChoice tones each carry a
 * distinct tactile style in the storybook palette family — warm (terracotta
 * rose), curious (honey), gentle (sage), practical (stone) and blunt (firmer
 * clay red). Gift choices keep their dedicated sage treatment.
 */
const TONE_STYLES: Record<NonNullable<DialogueChoice['tone']>, string> = {
  warm: 'bg-[#F7ECE6] hover:bg-[#EFE0D7] border-[#DEC1B4] text-[#4E2F23]',
  curious: 'bg-[#F8F0DD] hover:bg-[#F2E7CB] border-[#E2C98F] text-[#4F3A12]',
  gentle: 'bg-[#EEF3EC] hover:bg-[#E2ECE0] border-[#B6CBB5] text-[#263829]',
  practical: 'bg-[#F3E9D9] hover:bg-[#E9DBC6] border-[#D8C9B3] text-espresso',
  blunt: 'bg-[#F2E3DE] hover:bg-[#EAD6CF] border-[#C9A493] text-[#4E2F23]',
};

const TONE_CHEVRONS: Record<NonNullable<DialogueChoice['tone']>, string> = {
  warm: 'text-terracotta',
  curious: 'text-[#B98A2E]',
  gentle: 'text-sage',
  practical: 'text-espresso-muted',
  blunt: 'text-[#9E614C]',
};
import {
  getEmotionLabel,
  getHeartLevel,
  getRelationshipTier,
  getRelationshipTierLabel,
} from '../game/relationships';
import { getOwnedGiftableItems, PERSONAL_ITEM_CATEGORY_LABELS, PERSONAL_ITEM_MAP } from '../game/inventory';
import { RESIDENTS } from '../game/residents';
import { PropInteractionResult } from '../game/actions';

function renderRelationshipTierIcon(tier: RelationshipTier, label: string) {
  const title = `Relationship status: ${label}`;
  switch (tier) {
    case 'kindred':
      return (
        <span
          className="inline-flex items-center justify-center text-[#D48B1F]"
          title={title}
          aria-label={title}
          data-relationship-tier={tier}
        >
          <Sparkles className="w-3.5 h-3.5 fill-honey/25" />
        </span>
      );
    case 'close':
      return (
        <span
          className="inline-flex items-center justify-center text-terracotta-deep"
          title={title}
          aria-label={title}
          data-relationship-tier={tier}
        >
          <HeartHandshake className="w-3.5 h-3.5" />
        </span>
      );
    case 'friendly':
      return (
        <span
          className="inline-flex items-center justify-center text-terracotta"
          title={title}
          aria-label={title}
          data-relationship-tier={tier}
        >
          <Smile className="w-3.5 h-3.5" />
        </span>
      );
    case 'acquaintance':
      return (
        <span
          className="inline-flex items-center justify-center text-sage"
          title={title}
          aria-label={title}
          data-relationship-tier={tier}
        >
          <Sprout className="w-3.5 h-3.5" />
        </span>
      );
    case 'stranger':
    default:
      return (
        <span
          className="inline-flex items-center justify-center text-[#8C7D6F]"
          title={title}
          aria-label={title}
          data-relationship-tier={tier}
        >
          <UserRound className="w-3.5 h-3.5" />
        </span>
      );
  }
}

/** UI-only conversation history — last 6 displayed lines, never persisted. */
interface DialogueHistoryEntry {
  speaker: string;
  text: string;
}

const HISTORY_LINES = 6;

interface DialogueSheetProps {
  session: DialogueSession | null;
  propCard: PropInteractionResult | null;
  residentProgress: ResidentProgress | null;
  playerRelation?: PlayerNpcRelation | null;
  emotion?: CharacterEmotion;
  flags: StoryFlags;
  sideFlags?: Record<string, boolean | number | string>;
  world?: WorldState;
  onSelectChoice: (choice: DialogueChoice) => void;
  onGiveGift?: (itemId: PersonalItemId) => void;
  onClose: () => void;
  onPropAction: (actionType: NonNullable<PropInteractionResult['actionType']>) => void;
}

export const DialogueSheet: React.FC<DialogueSheetProps> = ({
  session,
  propCard,
  residentProgress,
  playerRelation,
  emotion,
  flags,
  sideFlags = {},
  world,
  onSelectChoice,
  onGiveGift,
  onClose,
  onPropAction,
}) => {
  const [giftPickerOpen, setGiftPickerOpen] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [history, setHistory] = useState<DialogueHistoryEntry[]>([]);
  const visualSize = useDialogueVisualSize();

  useEffect(() => {
    setGiftPickerOpen(false);
  }, [session?.residentId, session?.currentNodeId]);

  // History is UI-only state: reset when a new conversation begins, append the
  // displayed line whenever the current node advances. Capped at 6 entries.
  useEffect(() => {
    setHistory([]);
    setHistoryOpen(false);
  }, [session?.residentId, session?.topicId]);

  useEffect(() => {
    if (!session) return;
    const node =
      session.nodes[session.currentNodeId] ??
      session.nodes.root ??
      Object.values(session.nodes)[0];
    if (!node) return;
    setHistory((prev) =>
      [...prev, { speaker: node.speakerName, text: node.text }].slice(-HISTORY_LINES),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentNodeId, session?.residentId]);

  if (!session && !propCard) return null;

  if (propCard) {
    const subjectDesc = resolveSubjectImage(propCard.subjectImageKey);
    return (
      <div
        className="fixed inset-0 z-30 flex items-end justify-center p-2.5 sm:p-4 bg-espresso/10"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-label={propCard.title}
          onClick={(e) => e.stopPropagation()}
          className="animate-sheet-rise w-full max-w-lg bg-linen border border-[#CBB9A0] ring-1 ring-inset ring-[#E9DFCE] rounded-2xl shadow-elevation-sheet p-3.5 sm:p-5"
        >
          <div className="flex items-start gap-3">
            {/* Same visual slot as speaker portraits — object illustration */}
            <div className="animate-portrait-fade shrink-0 rounded-[26%] border-2 border-[#E6DAC7] overflow-hidden shadow-sm">
              <SubjectCanvas descriptor={subjectDesc} size={visualSize} />
            </div>
            <div className="flex items-start justify-between gap-3 min-w-0 flex-1">
              <h2 className="font-display text-lg sm:text-xl font-semibold text-espresso leading-snug break-words pt-1.5">
                {propCard.title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close inspection"
                className="min-h-[44px] min-w-[44px] -my-1 -mr-1.5 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-2.5 text-[15px] sm:text-base text-[#3D3128] leading-relaxed max-h-[26vh] overflow-y-auto storybook-scroll pr-1">
            {propCard.gainedItems && propCard.gainedItems.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 mb-2.5"
                aria-label="Tucked into your satchel"
              >
                {propCard.gainedItems.map((chip) => (
                  <span
                    key={`${chip.itemId}-${chip.count}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#EEF3EC] border border-[#A7C0A8] px-2 py-1 text-xs font-semibold text-[#38553C]"
                  >
                    <Sparkles className="w-3 h-3 text-sage" aria-hidden="true" />
                    +{chip.count} {PERSONAL_ITEM_MAP[chip.itemId]?.label ?? chip.itemId}
                  </span>
                ))}
              </div>
            )}
            {propCard.body}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-line bg-[#F3EADF] hover:bg-[#EADDCB] text-sm font-medium text-espresso transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
            {propCard.actionLabel && propCard.actionType && (
              <button
                type="button"
                onClick={() => onPropAction(propCard.actionType!)}
                className="min-h-[44px] px-4.5 py-2 rounded-xl bg-terracotta hover:bg-terracotta-deep text-sm font-semibold text-linen transition-colors cursor-pointer whitespace-nowrap"
              >
                {propCard.actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;
  const node =
    session.nodes[session.currentNodeId] ??
    session.nodes.root ??
    Object.values(session.nodes)[0];
  if (!node) return null;
  const resDef = RESIDENTS[session.residentId];
  const trust = playerRelation
    ? getHeartLevel(playerRelation.affinity)
    : residentProgress?.trust ?? 0;
  const resolvedTier: RelationshipTier = playerRelation
    ? getRelationshipTier(playerRelation.affinity)
    : session.tier ?? 'stranger';
  const tierLabel = getRelationshipTierLabel(resolvedTier);
  const emotionLabel = emotion ? getEmotionLabel(emotion) : node.moodLabel;
  const milestoneSeq = session.milestonePulseSeq ?? 0;
  // Priority 2: the speaker visual follows the node's portraitKey when present,
  // otherwise the resident's procedural default. Unknown keys never break the sheet.
  const portraitDesc = resolvePortrait(node.portraitKey, session.residentId);

  const availableChoices = node.choices.filter((c) =>
    world
      ? isChoiceAvailable(c, world, session.residentId)
      : isChoiceAvailable(c, flags, trust, sideFlags),
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center p-2.5 sm:p-4 bg-espresso/10"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Conversation with ${node.speakerName}`}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-rise w-full max-w-xl bg-linen border border-[#CBB9A0] ring-1 ring-inset ring-[#E9DFCE] rounded-2xl shadow-elevation-sheet p-3.5 sm:p-5"
      >
        {/* Storybook Header — speaker portrait owns the visual slot (Priority 3, Concept A) */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div
              key={milestoneSeq > 0 ? `${session.residentId}-milestone-${milestoneSeq}` : `${session.residentId}-idle`}
              data-testid="resident-dialogue-avatar"
              data-milestone-seq={milestoneSeq}
              className={`animate-portrait-fade rounded-[26%] border-2 overflow-hidden shrink-0 shadow-sm ${
                milestoneSeq > 0 ? 'animate-avatar-milestone border-honey' : 'border-[#E6DAC7]'
              }`}
              style={{ width: visualSize, height: visualSize }}
              aria-hidden="true"
            >
              <PortraitCanvas descriptor={portraitDesc} size={visualSize} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-display text-lg sm:text-xl font-semibold text-espresso truncate">
                  {node.speakerName}
                </h2>
                {renderRelationshipTierIcon(resolvedTier, tierLabel)}
                <div className="flex items-center gap-0.5 ml-0.5" aria-label={`Friendship ${trust} of 5`}>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <Heart
                      key={idx}
                      className={`w-3 h-3 ${
                        idx < trust
                          ? 'fill-terracotta text-terracotta'
                          : 'fill-transparent text-[#C7B7A2]'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-[11px] sm:text-xs text-espresso-muted flex items-center gap-x-1.5 flex-wrap leading-tight mt-1">
                <span>{node.speakerRole}</span>
                <span aria-hidden="true">·</span>
                <span>{emotionLabel}</span>
                <span className="font-medium text-sage whitespace-nowrap">
                  · {tierLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-expanded={historyOpen}
              aria-controls="dialogue-history-drawer"
              aria-label={historyOpen ? 'Hide recent lines' : 'Show recent lines'}
              data-testid="dialogue-history-toggle"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close conversation"
              className="min-h-[44px] min-w-[44px] -mt-0 -mr-1.5 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {historyOpen && (
          <div
            id="dialogue-history-drawer"
            data-testid="dialogue-history-drawer"
            aria-label="Recent conversation lines"
            className="mt-2.5 rounded-xl bg-card-warm border border-[#DFD1BC] p-2.5 max-h-[18vh] overflow-y-auto storybook-scroll space-y-1.5"
          >
            {history.length === 0 ? (
              <p className="text-xs text-espresso-muted px-1">The conversation just began.</p>
            ) : (
              history.map((entry, idx) => (
                <p key={`${idx}-${entry.speaker}`} className="text-[13px] text-[#4A3E33] leading-snug">
                  <span className="font-semibold text-espresso">{entry.speaker}:</span>{' '}
                  {entry.text}
                </p>
              ))
            )}
          </div>
        )}

        {(session.recentToast || session.milestoneLabel) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-sage">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{session.recentToast ?? session.milestoneLabel}</span>
          </div>
        )}

        {/* Dialogue Prose — ≥15px body on phone per the responsive spec (doc 09) */}
        <div className="relative mt-2.5 sm:mt-3">
          <p
            data-testid="dialogue-prose"
            className="text-[15px] sm:text-base text-espresso leading-relaxed max-h-[24vh] sm:max-h-[28vh] overflow-y-auto storybook-scroll pr-1 max-w-[65ch]"
          >
            “{node.text}”
          </p>
          {availableChoices.length > 0 && (
            <span
              aria-hidden="true"
              data-testid="dialogue-continue-hint"
              className="animate-continue-hint absolute bottom-0.5 right-0 text-terracotta"
            >
              <ChevronDown className="w-4 h-4" />
            </span>
          )}
        </div>

        {/* Clean Tactile Choices or Close */}
        <div className="mt-3 flex flex-col gap-1.5">
          {availableChoices.map((choice) => {
            const isGift = Boolean(choice.deliverHeldItem);
            // BUILD 04 a11y floor (Doc 08 §7.5): all five DialogueChoice.tone values
            // carry a distinct tactile style — gift keeps its own treatment.
            const toneStyle = isGift
              ? 'bg-[#EEF3EC] hover:bg-[#E2ECE0] border-[#B6CBB5] text-[#263829]'
              : TONE_STYLES[choice.tone ?? 'practical'];
            const toneChevron = isGift
              ? 'text-sage'
              : TONE_CHEVRONS[choice.tone ?? 'practical'];
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => onSelectChoice(choice)}
                className={`w-full min-h-[44px] px-3.5 py-2 text-left rounded-xl active:scale-[0.995] border text-sm font-medium transition-all cursor-pointer flex items-center justify-between gap-2.5 ${toneStyle}`}
              >
                <span className="leading-snug">{choice.label}</span>
                {isGift ? (
                  <Gift className="w-4 h-4 text-sage shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${toneChevron}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}

          {world && onGiveGift && session.currentNodeId !== 'gift_reaction' && (
            <div className="pt-1 border-t border-[#E6DAC7] mt-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setGiftPickerOpen((v) => !v)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#EEF3EC] hover:bg-[#E2ECE0] border border-[#B6CBB5] text-[#263829] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Gift className="w-4 h-4 text-sage shrink-0" />
                  <span>{giftPickerOpen ? 'Hide Satchel Gifts' : 'Offer Gift from Satchel'}</span>
                </button>
              </div>

              {giftPickerOpen && (
                <div className="p-2.5 rounded-xl bg-card-warm border border-[#DFD1BC] max-h-[22vh] overflow-y-auto storybook-scroll space-y-1.5">
                  {world.dailyActivities?.giftedResidentsToday?.includes(session.residentId) ? (
                    <p className="text-xs text-umber px-1 py-1">
                      You already shared a gift with {node.speakerName} today. Stop by again tomorrow!
                    </p>
                  ) : (
                    (() => {
                      const ownedGifts = getOwnedGiftableItems(world.inventory);
                      if (ownedGifts.length === 0) {
                        return (
                          <p className="text-xs text-umber px-1 py-1">
                            Your satchel has no giftable items right now—gather blossoms, orchard crabapples, or bake at your cottage hearth.
                          </p>
                        );
                      }
                      return ownedGifts.map(({ def, count }) => (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => {
                            setGiftPickerOpen(false);
                            onGiveGift(def.id);
                          }}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-linen hover:bg-[#EFE5D5] border border-stone-line text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          {/* BUILD 04 item thumbnails (Doc 03 §9.3): the gift picker
                             reuses the SubjectCanvas painter — same visual voice as
                             the satchel. */}
                          <SubjectCanvas
                            descriptor={subjectForItem(def.id)}
                            size={36}
                            className="shrink-0 rounded-lg border border-parchment"
                          />
                          <div className="min-w-0 flex-1 pl-1">
                            <div className="text-xs sm:text-sm font-semibold text-espresso truncate">
                              {def.label}
                            </div>
                            <div className="text-[11px] text-espresso-muted">
                              {PERSONAL_ITEM_CATEGORY_LABELS[def.category]}
                            </div>
                          </div>
                          <span className="font-mono-nums text-xs font-semibold text-sage shrink-0">
                            ×{count} · Give
                          </span>
                        </button>
                      ));
                    })()
                  )}
                </div>
              )}
            </div>
          )}

          {(node.isEnd || availableChoices.length === 0) && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-terracotta hover:bg-terracotta-deep text-sm font-semibold text-linen transition-colors cursor-pointer"
              >
                {emotion === 'frustrated' || emotion === 'angry' || emotion === 'sad'
                  ? 'Step Back Gently'
                  : playerRelation && playerRelation.affinity >= 60
                  ? 'Wave Warmly'
                  : 'Wave Goodbye'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
