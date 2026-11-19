import React from 'react';
import {
  ChevronRight,
  Gift,
  Heart,
  HeartHandshake,
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
  PlayerNpcRelation,
  RelationshipTier,
  ResidentProgress,
  StoryFlags,
  WorldState,
} from '../game/types';
import { isChoiceAvailable } from '../game/narrative';
import {
  getEmotionLabel,
  getHeartLevel,
  getRelationshipTier,
  getRelationshipTierLabel,
} from '../game/relationships';
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
          <Sparkles className="w-3.5 h-3.5 fill-[#E5A93C]/25" />
        </span>
      );
    case 'close':
      return (
        <span
          className="inline-flex items-center justify-center text-[#B45539]"
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
          className="inline-flex items-center justify-center text-[#C86446]"
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
          className="inline-flex items-center justify-center text-[#5E8062]"
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
  onClose: () => void;
  onPropAction: (actionType: 'rest_next_day' | 'ring_bell' | 'fountain_wish' | 'skip_stone') => void;
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
  onClose,
  onPropAction,
}) => {
  if (!session && !propCard) return null;

  if (propCard) {
    return (
      <div
        className="fixed inset-0 z-30 flex items-end justify-center p-2.5 sm:p-4 bg-[#2D241E]/10"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-label={propCard.title}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[#FAF5EC] border border-[#CBB9A0] ring-1 ring-inset ring-[#E9DFCE] rounded-2xl shadow-[0_14px_36px_rgba(45,36,30,0.22)] p-3.5 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2D241E] truncate">
              {propCard.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspection"
              className="min-h-[44px] min-w-[44px] -my-1 -mr-1.5 flex items-center justify-center rounded-xl text-[#6A5B50] hover:bg-[#EFE5D5] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-2 text-sm sm:text-[15px] text-[#3D3128] leading-relaxed max-h-[26vh] overflow-y-auto storybook-scroll pr-1">
            {propCard.body}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D4C4AE] bg-[#F3EADF] hover:bg-[#EADDCB] text-sm font-medium text-[#2D241E] transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
            {propCard.actionLabel && propCard.actionType && (
              <button
                type="button"
                onClick={() => onPropAction(propCard.actionType!)}
                className="min-h-[44px] px-4.5 py-2 rounded-xl bg-[#C86446] hover:bg-[#B45539] text-sm font-semibold text-[#FAF5EC] transition-colors cursor-pointer whitespace-nowrap"
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

  const availableChoices = node.choices.filter((c) =>
    world
      ? isChoiceAvailable(c, world, session.residentId)
      : isChoiceAvailable(c, flags, trust, sideFlags),
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center p-2.5 sm:p-4 bg-[#2D241E]/10"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Conversation with ${node.speakerName}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#FAF5EC] border border-[#CBB9A0] ring-1 ring-inset ring-[#E9DFCE] rounded-2xl shadow-[0_14px_36px_rgba(45,36,30,0.22)] p-3.5 sm:p-5"
      >
        {/* Compact Storybook Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              key={milestoneSeq > 0 ? `${session.residentId}-milestone-${milestoneSeq}` : `${session.residentId}-idle`}
              data-testid="resident-dialogue-avatar"
              data-milestone-seq={milestoneSeq}
              className={`w-10 h-10 rounded-full shrink-0 border-2 flex items-center justify-center font-display font-bold text-base text-[#FAF5EC] shadow-sm ${
                milestoneSeq > 0
                  ? 'animate-avatar-milestone border-[#E5A93C]'
                  : 'border-[#E6DAC7]'
              }`}
              style={{ backgroundColor: resDef.appearance.coatColor }}
              aria-hidden="true"
            >
              {node.speakerName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2D241E] truncate">
                  {node.speakerName}
                </h2>
                {renderRelationshipTierIcon(resolvedTier, tierLabel)}
                <div className="flex items-center gap-0.5 ml-0.5" aria-label={`Friendship ${trust} of 5`}>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <Heart
                      key={idx}
                      className={`w-3 h-3 ${
                        idx < trust
                          ? 'fill-[#C86446] text-[#C86446]'
                          : 'fill-transparent text-[#C7B7A2]'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-[11px] sm:text-xs text-[#6A5B50] flex items-center gap-x-1.5 flex-wrap leading-tight mt-0.5">
                <span>{node.speakerRole}</span>
                <span aria-hidden="true">·</span>
                <span>{emotionLabel}</span>
                <span className="font-medium text-[#5E8062] whitespace-nowrap">
                  · {tierLabel}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation"
            className="min-h-[44px] min-w-[44px] -mt-1 -mr-1.5 flex items-center justify-center rounded-xl text-[#6A5B50] hover:bg-[#EFE5D5] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(session.recentToast || session.milestoneLabel) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#5E8062]">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{session.recentToast ?? session.milestoneLabel}</span>
          </div>
        )}

        {/* Dialogue Prose */}
        <p className="mt-2.5 sm:mt-3 text-sm sm:text-[15px] text-[#2D241E] leading-relaxed max-h-[24vh] sm:max-h-[28vh] overflow-y-auto storybook-scroll pr-1 max-w-[65ch]">
          “{node.text}”
        </p>

        {/* Clean Tactile Choices or Close */}
        <div className="mt-3 flex flex-col gap-1.5">
          {availableChoices.map((choice) => {
            const isGift = Boolean(choice.deliverHeldItem);
            const isBlunt = choice.tone === 'blunt' || Boolean(choice.isNegative);
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => onSelectChoice(choice)}
                className={`w-full min-h-[44px] px-3.5 py-2 text-left rounded-xl active:scale-[0.995] border text-sm font-medium transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                  isGift
                    ? 'bg-[#EEF3EC] hover:bg-[#E2ECE0] border-[#B6CBB5] text-[#263829]'
                    : isBlunt
                    ? 'bg-[#F7ECE6] hover:bg-[#EFE0D7] border-[#DEC1B4] text-[#4E2F23]'
                    : 'bg-[#F3E9D9] hover:bg-[#E9DBC6] border-[#D8C9B3] text-[#2D241E]'
                }`}
              >
                <span className="leading-snug">{choice.label}</span>
                {isGift ? (
                  <Gift className="w-4 h-4 text-[#5E8062] shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isBlunt ? 'text-[#9E614C]' : 'text-[#C86446]'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}

          {(node.isEnd || availableChoices.length === 0) && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#C86446] hover:bg-[#B45539] text-sm font-semibold text-[#FAF5EC] transition-colors cursor-pointer"
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
