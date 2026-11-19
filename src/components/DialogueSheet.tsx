import React from 'react';
import { Heart, Sparkles, X } from 'lucide-react';
import {
  CharacterEmotion,
  DialogueChoice,
  DialogueSession,
  PlayerNpcRelation,
  ResidentProgress,
  StoryFlags,
} from '../game/types';
import { isChoiceAvailable } from '../game/narrative';
import {
  getEmotionLabel,
  getRelationshipTier,
  getRelationshipTierLabel,
} from '../game/relationships';
import { RESIDENTS } from '../game/residents';
import { PropInteractionResult } from '../game/actions';

interface DialogueSheetProps {
  session: DialogueSession | null;
  propCard: PropInteractionResult | null;
  residentProgress: ResidentProgress | null;
  playerRelation?: PlayerNpcRelation | null;
  emotion?: CharacterEmotion;
  flags: StoryFlags;
  sideFlags?: Record<string, boolean | number | string>;
  onSelectChoice: (choice: DialogueChoice) => void;
  onClose: () => void;
  onPropAction: (actionType: 'rest_next_day' | 'ring_bell') => void;
}

export const DialogueSheet: React.FC<DialogueSheetProps> = ({
  session,
  propCard,
  residentProgress,
  playerRelation,
  emotion,
  flags,
  sideFlags = {},
  onSelectChoice,
  onClose,
  onPropAction,
}) => {
  if (!session && !propCard) return null;

  if (propCard) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-5 pointer-events-none flex justify-center">
        <div
          role="dialog"
          aria-label={propCard.title}
          className="w-full max-w-xl bg-[#FAF5EC] border border-[#D4C4AE] rounded-2xl shadow-[0_14px_38px_rgba(45,36,30,0.22)] p-5 sm:p-6 pointer-events-auto"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#2D241E]">
                {propCard.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspection"
              className="min-h-[44px] min-w-[44px] -mt-1 -mr-1 flex items-center justify-center rounded-xl text-[#6A5B50] hover:bg-[#EFE5D5] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-2.5 text-sm sm:text-base text-[#3D3128] leading-relaxed">
            {propCard.body}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
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
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#C86446] hover:bg-[#B45539] text-sm font-semibold text-[#FAF5EC] transition-colors cursor-pointer whitespace-nowrap"
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
  const trust = residentProgress?.trust ?? 0;
  const tierLabel = playerRelation
    ? getRelationshipTierLabel(getRelationshipTier(playerRelation.affinity))
    : session.tier
    ? getRelationshipTierLabel(session.tier)
    : null;
  const emotionLabel = emotion ? getEmotionLabel(emotion) : node.moodLabel;

  const availableChoices = node.choices.filter((c) =>
    isChoiceAvailable(c, flags, trust, sideFlags),
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-5 pointer-events-none flex justify-center">
      <div
        role="dialog"
        aria-label={`Conversation with ${node.speakerName}`}
        className="w-full max-w-2xl bg-[#FAF5EC] border border-[#D4C4AE] rounded-2xl shadow-[0_14px_40px_rgba(45,36,30,0.24)] p-5 sm:p-6 pointer-events-auto"
      >
        {/* Header with character color medallion, name, clean unboxed metadata, and trust pips */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-full shrink-0 border-2 border-[#E6DAC7] flex items-center justify-center font-display font-bold text-lg text-[#FAF5EC] shadow-sm"
              style={{ backgroundColor: resDef.appearance.coatColor }}
              aria-hidden="true"
            >
              {node.speakerName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display text-xl font-semibold text-[#2D241E] truncate">
                  {node.speakerName}
                </h2>
                <div className="flex items-center gap-1" aria-label={`Friendship ${trust} of 5`}>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <Heart
                      key={idx}
                      className={`w-3.5 h-3.5 ${
                        idx < trust
                          ? 'fill-[#C86446] text-[#C86446]'
                          : 'fill-transparent text-[#C7B7A2]'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-xs text-[#6A5B50] flex items-center gap-1.5 flex-wrap">
                <span>{node.speakerRole}</span>
                <span aria-hidden="true">·</span>
                <span>{emotionLabel}</span>
                {tierLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#5E8062]">{tierLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation"
            className="min-h-[44px] min-w-[44px] -mt-1 -mr-1 flex items-center justify-center rounded-xl text-[#6A5B50] hover:bg-[#EFE5D5] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {session.recentToast && (
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#5E8062]">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{session.recentToast}</span>
          </div>
        )}

        {/* Dialogue Prose */}
        <p className="mt-3.5 text-base text-[#2D241E] leading-relaxed max-w-[68ch]">
          “{node.text}”
        </p>

        {/* Branching Choices or Close */}
        <div className="mt-4 flex flex-col gap-2">
          {availableChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onSelectChoice(choice)}
              className="w-full min-h-[46px] px-4 py-2.5 text-left rounded-xl bg-[#F2E9DA] hover:bg-[#E7DAC6] active:scale-[0.995] border border-[#D8C9B3] text-sm sm:text-base font-medium text-[#2D241E] transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <span>{choice.label}</span>
              <span
                className={`text-xs font-semibold shrink-0 ${
                  choice.deliverHeldItem
                    ? 'text-[#5E8062]'
                    : choice.tone === 'blunt' || choice.isNegative
                    ? 'text-[#8A5A44]'
                    : 'text-[#C86446]'
                }`}
              >
                {choice.deliverHeldItem
                  ? 'Gift'
                  : choice.tone === 'blunt' || choice.isNegative
                  ? 'Blunt'
                  : 'Reply'}
              </span>
            </button>
          ))}

          {(node.isEnd || availableChoices.length === 0) && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-6 py-2 rounded-xl bg-[#C86446] hover:bg-[#B45539] text-sm font-semibold text-[#FAF5EC] transition-colors cursor-pointer"
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
