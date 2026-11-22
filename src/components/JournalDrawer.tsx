import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Clock,
  Compass,
  Feather,
  Heart,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  JournalTabId,
  buildPocketJournalView,
  loadJournalReadKeys,
  saveJournalReadKeys,
} from '../game/journal';
import { WorldState } from '../game/types';
import { PortraitCanvas } from './DialogueVisuals';
import { resolvePortrait } from '../game/dialogue/assets';

interface JournalDrawerProps {
  open: boolean;
  world: WorldState;
  onClose: () => void;
  onAdvanceTime: () => void;
  initialTab?: JournalTabId;
}

const TAB_DEFS: ReadonlyArray<{
  id: JournalTabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'stories', label: 'Stories', Icon: BookOpen },
  { id: 'memories', label: 'Memories', Icon: Feather },
  { id: 'people', label: 'People', Icon: Users },
  { id: 'discoveries', label: 'Discoveries', Icon: Compass },
];

export const JournalDrawer: React.FC<JournalDrawerProps> = ({
  open,
  world,
  onClose,
  onAdvanceTime,
  initialTab = 'stories',
}) => {
  const [tab, setTab] = useState<JournalTabId>(initialTab);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => loadJournalReadKeys());
  const wasOpenRef = useRef<boolean>(false);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  const journal = useMemo(
    () => buildPocketJournalView(world, seenKeys),
    [world, seenKeys],
  );

  const markTabEntriesRead = useCallback(
    (targetTab: JournalTabId) => {
      const keysForTab = journal.tabEntryKeys[targetTab];
      if (!keysForTab || keysForTab.length === 0) return;
      setSeenKeys((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const k of keysForTab) {
          if (!next.has(k)) {
            next.add(k);
            changed = true;
          }
        }
        if (!changed) return prev;
        saveJournalReadKeys(next);
        return next;
      });
    },
    [journal.tabEntryKeys],
  );

  const markAllRead = useCallback(() => {
    const allKeys = [
      ...journal.tabEntryKeys.stories,
      ...journal.tabEntryKeys.memories,
      ...journal.tabEntryKeys.people,
      ...journal.tabEntryKeys.discoveries,
    ];
    setSeenKeys((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const k of allKeys) {
        if (!next.has(k)) {
          next.add(k);
          changed = true;
        }
      }
      if (!changed) return prev;
      saveJournalReadKeys(next);
      return next;
    });
  }, [journal.tabEntryKeys]);

  // Reset scroll position when switching tabs
  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
  }, [tab]);

  // When closing after having opened, mark the currently viewed tab's entries as previously read
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      markTabEntriesRead(tab);
    }
  }, [open, tab, markTabEntriesRead]);

  const handleSelectTab = (nextTab: JournalTabId) => {
    if (nextTab === tab) return;
    markTabEntriesRead(tab);
    setTab(nextTab);
  };

  const handleClose = () => {
    markTabEntriesRead(tab);
    onClose();
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number,
  ) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % TAB_DEFS.length;
    else if (e.key === 'ArrowLeft')
      nextIdx = (currentIdx - 1 + TAB_DEFS.length) % TAB_DEFS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TAB_DEFS.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = TAB_DEFS[nextIdx].id;
      handleSelectTab(nextTab);
      const targetBtn = document.getElementById(`journal-tab-${nextTab}`);
      targetBtn?.focus();
    }
  };

  if (!open) return null;

  const totalUnread =
    journal.newCounts.stories +
    journal.newCounts.memories +
    journal.newCounts.people +
    journal.newCounts.discoveries;

  const completedMainCount = journal.mainStorySteps.filter(
    (s) => s.status === 'completed',
  ).length;
  const totalMainSteps = world.flags.heardBellMystery ? 5 : 1;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-espresso/45 pointer-events-auto"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-label="Pocket Journal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[86vh] bg-linen border border-stone-line rounded-2xl shadow-elevation-drawer flex flex-col overflow-hidden"
      >
        {/* Notebook Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-espresso leading-tight">
              Pocket Journal
            </h2>
            <p className="text-xs text-espresso-muted mt-0.5 leading-snug">
              <span className="font-mono-nums">Day {journal.day}</span> ({journal.seasonLabel}) ·{' '}
              {journal.phaseLabel} · {journal.weatherLabel} ·{' '}
              <span className="font-mono-nums">{journal.memories.length}</span>{' '}
              {journal.memories.length === 1 ? 'Memory' : 'Memories'} Saved
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {totalUnread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium text-umber hover:bg-[#EFE5D5] transition-colors cursor-pointer whitespace-nowrap"
              >
                Mark read
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close journal"
              className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-espresso-muted hover:bg-[#EFE5D5] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Segmented Navigation Tabs (2x2 thumb grid on mobile, single-row on sm+) */}
        <div
          role="tablist"
          aria-label="Journal sections"
          className="px-3 sm:px-5 pt-2.5 sm:pt-3 pb-2.5 border-b border-[#EFE5D6] grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2"
        >
          {TAB_DEFS.map((t, idx) => {
            const Icon = t.Icon;
            const active = tab === t.id;
            const unreadCount = journal.newCounts[t.id];
            return (
              <button
                key={t.id}
                id={`journal-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="journal-tabpanel"
                tabIndex={active ? 0 : -1}
                onClick={() => handleSelectTab(t.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`min-w-0 w-full sm:w-auto min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap sm:shrink-0 ${
                  active
                    ? 'bg-terracotta text-linen'
                    : 'bg-linen-deep text-[#4E4036] hover:bg-[#E7DAC5]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
                {unreadCount > 0 && (
                  <span
                    className={`font-mono-nums text-[11px] font-semibold ${
                      active ? 'text-linen/90' : 'text-terracotta-deep'
                    }`}
                    aria-label={`${unreadCount} new`}
                  >
                    · {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notebook Pages */}
        <div
          ref={bodyScrollRef}
          id="journal-tabpanel"
          role="tabpanel"
          aria-labelledby={`journal-tab-${tab}`}
          className="flex-1 overflow-y-auto overflow-x-hidden storybook-scroll p-4 sm:p-5 space-y-6"
        >
          {/* ================= 1. NEIGHBORHOOD STORIES ================= */}
          {tab === 'stories' && (
            <div className="space-y-6">
              {journal.activeInvitation && (
                <section aria-labelledby="journal-heading-invitation">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[#FDF6E7] border border-[#D9B87A] flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3
                        id="journal-heading-invitation"
                        className="font-display text-base font-semibold text-espresso"
                      >
                        Today&apos;s Invitation · {journal.activeInvitation.title}
                      </h3>
                      <span className="text-xs font-semibold text-[#9A5B32] shrink-0">
                        {journal.activeInvitation.status === 'accepted'
                          ? 'Accepted · Ready indoors'
                          : 'Awaiting your answer'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#3D3128] leading-snug">
                      {journal.activeInvitation.status === 'accepted'
                        ? `${journal.activeInvitation.hostName} is waiting inside ${journal.activeInvitation.locationLabel}.`
                        : `${journal.activeInvitation.hostName} asked if you'd like to meet at ${journal.activeInvitation.locationLabel}.`}
                    </p>
                    <p className="text-[11px] font-mono-nums text-espresso-muted">
                      Window today: {journal.activeInvitation.windowLabel}
                    </p>
                  </div>
                </section>
              )}

              {/* Main Neighborhood Thread */}
              <section aria-labelledby="journal-heading-main-story">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h3
                    id="journal-heading-main-story"
                    className="font-display text-lg font-semibold text-espresso"
                  >
                    {journal.mainStoryTitle}
                  </h3>
                  <span className="text-xs text-espresso-muted font-mono-nums shrink-0">
                    {completedMainCount}/{totalMainSteps} Chapters
                  </span>
                </div>

                <div className="space-y-2.5">
                  {journal.mainStorySteps.map((step) => {
                    const isCompleted = step.status === 'completed';
                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                          step.isNew
                            ? 'bg-[#F7EFE2] border-[#D9BC96]'
                            : isCompleted
                            ? 'bg-[#F3F5EE] border-[#CEDAC8]'
                            : 'bg-card-warm border-parchment'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center border ${
                            isCompleted
                              ? 'bg-sage border-sage text-linen'
                              : 'bg-linen border-[#C9B8A3] text-terracotta'
                          }`}
                          aria-hidden="true"
                        >
                          {isCompleted ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                            <p
                              className={`text-sm font-semibold ${
                                isCompleted ? 'text-espresso' : 'text-[#3D3128]'
                              }`}
                            >
                              {step.title}
                            </p>
                            <span className="text-[11px] font-medium text-espresso-muted shrink-0">
                              {step.isNew ? (
                                <span className="text-terracotta-deep font-semibold">New · </span>
                              ) : null}
                              {isCompleted ? 'Completed' : 'Ongoing'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-[13px] text-umber mt-1 leading-relaxed">
                            {step.detailText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Ongoing Personal & Neighborhood Storylines */}
              <section aria-labelledby="journal-heading-active-stories">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h3
                    id="journal-heading-active-stories"
                    className="font-display text-lg font-semibold text-espresso"
                  >
                    Ongoing Developments
                  </h3>
                  {journal.activeStorylines.length > 0 && (
                    <span className="text-xs text-espresso-muted font-mono-nums shrink-0">
                      {journal.activeStorylines.length} Active
                    </span>
                  )}
                </div>

                {journal.activeStorylines.length === 0 ? (
                  <div className="p-4 rounded-xl bg-card-warm border border-parchment text-sm text-umber leading-relaxed">
                    {journal.completedStorylines.length > 0
                      ? 'Every thread you have begun along the lane is settled for now. Chat warmly with neighbors as the days turn to uncover new ones.'
                      : 'No personal threads started yet. Keep chatting with neighbors around Willow Step Lane—new stories open up as friendships deepen.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {journal.activeStorylines.map((story) => (
                      <article
                        key={story.id}
                        className={`p-4 rounded-xl border space-y-2 ${
                          story.isNew
                            ? 'bg-[#F7EFE2] border-[#D9BC96]'
                            : 'bg-card-warm border-parchment'
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="font-display text-base font-semibold text-espresso">
                            {story.title}
                          </h4>
                          <span className="text-xs text-espresso-muted shrink-0">
                            {story.isNew ? (
                              <span className="text-terracotta-deep font-semibold">New · </span>
                            ) : null}
                            Ongoing ·{' '}
                            <span className="font-mono-nums">
                              Part {story.stage}/{story.totalStages}
                            </span>
                          </span>
                        </div>

                        <p className="text-xs text-espresso-muted">
                          {story.category === 'interconnected_conflict'
                            ? 'Neighborhood matter'
                            : 'Personal story'}{' '}
                          · {story.stageTitle}
                          {story.involvedNames.length > 0
                            ? ` · With ${story.involvedNames.join(', ')}`
                            : ''}
                        </p>

                        <p className="text-sm text-[#3D3128] leading-relaxed">
                          {story.detailText}
                        </p>

                        {story.cooldownText && (
                          <p className="text-xs font-medium text-[#9A5B32]">
                            {story.cooldownText}
                          </p>
                        )}

                        {story.notes.length > 0 && (
                          <ul className="pt-2 border-t border-[#E5D9C7] space-y-1 text-xs text-umber">
                            {story.notes.map((note, idx) => (
                              <li key={idx}>• {note}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Completed Stories */}
              {journal.completedStorylines.length > 0 && (
                <section aria-labelledby="journal-heading-completed-stories">
                  <div className="flex items-baseline justify-between gap-2 mb-3">
                    <h3
                      id="journal-heading-completed-stories"
                      className="font-display text-lg font-semibold text-espresso"
                    >
                      Completed Stories
                    </h3>
                    <span className="text-xs text-sage font-mono-nums shrink-0">
                      {journal.completedStorylines.length} Settled
                    </span>
                  </div>

                  <div className="space-y-3">
                    {journal.completedStorylines.map((story) => (
                      <article
                        key={story.id}
                        className={`p-4 rounded-xl border space-y-2 ${
                          story.isNew
                            ? 'bg-[#EEF3EC] border-[#A7C0A8]'
                            : 'bg-[#F3F5EE] border-[#CEDAC8]'
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-5 h-5 rounded-full bg-sage text-linen flex items-center justify-center shrink-0"
                              aria-hidden="true"
                            >
                              <Check className="w-3 h-3" />
                            </span>
                            <h4 className="font-display text-base font-semibold text-espresso">
                              {story.title}
                            </h4>
                          </div>
                          <span className="text-xs text-[#4B6B4F] shrink-0">
                            {story.isNew ? (
                              <span className="text-terracotta-deep font-semibold">New · </span>
                            ) : null}
                            Completed
                            {story.completedDay !== undefined ? (
                              <span className="font-mono-nums"> · Day {story.completedDay}</span>
                            ) : null}
                          </span>
                        </div>

                        {story.outcomeLabel && (
                          <p className="text-xs font-semibold text-[#4B6B4F]">
                            Outcome: {story.outcomeLabel}
                            {story.involvedNames.length > 0
                              ? ` · With ${story.involvedNames.join(', ')}`
                              : ''}
                          </p>
                        )}

                        <p className="text-sm text-[#3D3128] leading-relaxed">
                          {story.detailText}
                        </p>

                        {story.notes.length > 0 && (
                          <ul className="pt-2 border-t border-[#D8E2D2] space-y-1 text-xs text-[#516051]">
                            {story.notes.map((note, idx) => (
                              <li key={idx}>• {note}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ================= 2. PERSONAL MEMORIES ================= */}
          {tab === 'memories' && (
            <section aria-labelledby="journal-heading-memories" className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3
                  id="journal-heading-memories"
                  className="font-display text-lg font-semibold text-espresso"
                >
                  Personal Memories
                </h3>
                <span className="text-xs text-espresso-muted font-mono-nums shrink-0">
                  {journal.memories.length} Recorded
                </span>
              </div>

              {journal.memories.length === 0 ? (
                <div className="p-4 rounded-xl bg-card-warm border border-parchment text-sm text-umber">
                  Your notebook pages are open and ready for your first shared moments along the lane.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {journal.memories.map((mem) => (
                    <article
                      key={mem.id}
                      className={`p-3.5 sm:p-4 rounded-xl border ${
                        mem.isNew
                          ? 'bg-[#F7EFE2] border-[#D9BC96]'
                          : 'bg-linen border-parchment'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-display text-base font-semibold text-espresso">
                          {mem.title}
                        </h4>
                        <span className="text-xs text-espresso-muted shrink-0">
                          {mem.isNew ? (
                            <span className="text-terracotta-deep font-semibold">New · </span>
                          ) : (
                            <span>Read · </span>
                          )}
                          <span className="font-mono-nums">Day {mem.day}</span> · {mem.phaseLabel}
                          {mem.residentName ? ` · ${mem.residentName}` : ''}
                        </span>
                      </div>
                      <p className="text-sm text-[#4A3C32] mt-1.5 leading-relaxed">
                        {mem.summary}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ================= 3. PEOPLE ================= */}
          {tab === 'people' && (
            <section aria-labelledby="journal-heading-people" className="space-y-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3
                  id="journal-heading-people"
                  className="font-display text-lg font-semibold text-espresso"
                >
                  Neighbors Around the Lane
                </h3>
                <span className="text-xs text-espresso-muted font-mono-nums shrink-0">
                  {journal.people.filter((p) => p.met).length}/{journal.people.length} Met
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {journal.people.map((person) => (
                  <article
                    key={person.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                      person.isNew
                        ? 'bg-[#F7EFE2] border-[#D9BC96]'
                        : 'bg-card-warm border-parchment'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* BUILD 04 portrait unification (Doc 03 §9.4): People cards
                             reuse the dialogue's procedural knit-portrait painter.
                             Un-met neighbors keep the coat-color initial — the
                             mystery is part of the story. */}
                          {person.met ? (
                            <PortraitCanvas
                              descriptor={resolvePortrait(undefined, person.id)}
                              size={40}
                              className="shrink-0 rounded-full"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full shrink-0 border-2 border-linen flex items-center justify-center font-display font-bold text-linen"
                              style={{ backgroundColor: person.coatColor }}
                              aria-hidden="true"
                            >
                              {person.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <h4 className="font-display text-lg font-semibold text-espresso">
                                {person.name}
                              </h4>
                              {person.cueKind !== 'none' && (
                                <span className="text-xs font-semibold text-terracotta-deep">
                                  · {person.cueTitle ?? 'Story waiting'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-espresso-muted leading-snug">
                              {person.roleLabel}
                            </p>
                          </div>
                        </div>

                        {person.met && (
                          <div
                            className="flex items-center gap-0.5 shrink-0 pt-1"
                            aria-label={`Trust ${person.trust} of 5`}
                          >
                            {[0, 1, 2, 3, 4].map((idx) => (
                              <Heart
                                key={idx}
                                className={`w-3.5 h-3.5 ${
                                  idx < person.trust
                                    ? 'fill-terracotta text-terracotta'
                                    : 'fill-transparent text-[#C7B7A2]'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {!person.met ? (
                        <p className="text-sm text-umber leading-relaxed">
                          Haven’t introduced yourselves yet — stop by to say hello when you pass in the square.
                        </p>
                      ) : (
                        <>
                          {person.personality && (
                            <p className="text-sm text-[#3D3128] leading-snug">
                              {person.personality}
                            </p>
                          )}

                          {person.chapter && (
                            <p className="text-xs text-[#7A6A5B] leading-relaxed italic">
                              {person.chapter}
                            </p>
                          )}

                          {person.knownNotes.length > 0 && (
                            <div className="pt-2 border-t border-[#E5D9C7] space-y-1.5">
                              <p className="text-[11px] font-semibold text-espresso-muted">
                                Shared notes &amp; word heard
                              </p>
                              <ul className="space-y-1.5">
                                {person.knownNotes.map((note) => (
                                  <li
                                    key={note.entryKey}
                                    className="text-xs text-[#3D3128] leading-relaxed"
                                  >
                                    <span
                                      className={`font-semibold ${
                                        note.certaintyKind === 'rumor'
                                          ? 'text-[#9A5B32]'
                                          : note.certaintyKind === 'secondhand'
                                          ? 'text-espresso-muted'
                                          : 'text-sage'
                                      }`}
                                    >
                                      {note.isNew ? 'New · ' : ''}
                                      {note.certaintyLabel}:{' '}
                                    </span>
                                    <span>{note.text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {person.discoveredConnections.length > 0 && (
                            <p className="text-xs text-espresso-muted">
                              Connected with {person.discoveredConnections.join(', ')}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#E5D9C7] text-xs text-umber flex flex-col gap-1">
                      {person.met && person.tierLabel && person.emotionLabel && person.reliabilityLabel && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-espresso-muted">
                          <span>
                            {person.tierLabel} · {person.emotionLabel}
                          </span>
                          <span>{person.reliabilityLabel}</span>
                        </div>
                      )}
                      <span className="font-medium truncate">
                        {person.met ? `Around: ${person.placeLabel}` : person.placeLabel}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ================= 4. DISCOVERIES ================= */}
          {tab === 'discoveries' && (
            <div className="space-y-6">
              {/* Time Control Card */}
              <div className="p-4 rounded-xl bg-card-warm border border-parchment flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-espresso">
                    Watch the Neighborhood Shift
                  </h3>
                  <p className="text-sm text-umber mt-0.5">
                    Neighbors walk between cottages, the plaza, and Mirror Pond across Morning, Afternoon, Golden Hour, and Lantern Dusk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    markTabEntriesRead(tab);
                    onAdvanceTime();
                    onClose();
                  }}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-sage hover:bg-[#4F6E53] text-sm font-semibold text-linen flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Clock className="w-4 h-4" />
                  <span>Advance 2 Hours</span>
                </button>
              </div>

              {/* Season & Sky */}
              <section
                aria-labelledby="journal-heading-sky"
                className="p-4 rounded-xl bg-card-warm border border-parchment"
              >
                <h3
                  id="journal-heading-sky"
                  className="font-display text-lg font-semibold text-espresso mb-2"
                >
                  Sky, Season &amp; Neighborhood Rhythm
                </h3>
                <ul className="text-sm text-[#3D3128] space-y-1.5">
                  <li>
                    Season:{' '}
                    <strong>
                      {journal.seasonLabel} — Day{' '}
                      <span className="font-mono-nums">{journal.dayOfSeason}</span> of 10, Year{' '}
                      <span className="font-mono-nums">{journal.year}</span>
                    </strong>
                  </li>
                  <li>
                    Today&apos;s sky: <strong>{journal.weatherLabel}</strong>
                  </li>
                  <li>
                    Tomorrow&apos;s forecast: <strong>{journal.tomorrowForecastLabel}</strong>
                  </li>
                  <li>
                    Plaza noticeboard flyers:{' '}
                    <strong className="font-mono-nums">{journal.noticeboardFlyerCount}/3</strong>{' '}
                    posted
                  </li>
                  <li>
                    Sunbeam Greenhouse bloom stage:{' '}
                    <strong className="font-mono-nums">Stage {journal.greenhouseStage}/3</strong>
                  </li>
                  <li>
                    Window-box planters blooming:{' '}
                    <strong className="font-mono-nums">{journal.plantersBloomed}/3</strong>
                  </li>
                </ul>
              </section>

              {/* Willow Step Cottage & Home Life */}
              <section
                aria-labelledby="journal-heading-cottage-home"
                className="p-4 rounded-xl bg-card-warm border border-parchment"
              >
                <h3
                  id="journal-heading-cottage-home"
                  className="font-display text-lg font-semibold text-espresso mb-2"
                >
                  Willow Step Cottage &amp; Satchel
                </h3>
                <ul className="text-sm text-[#3D3128] space-y-1.5">
                  <li>
                    Table centerpiece: <strong>{journal.homeSummary.vaseDescription}</strong>
                  </li>
                  <li>
                    Keepsake shelf:{' '}
                    <strong>
                      {journal.homeSummary.displayedKeepsakeLabels.length > 0
                        ? journal.homeSummary.displayedKeepsakeLabels.join(', ')
                        : 'No neighbor keepsakes arranged on the shelf yet'}
                    </strong>
                  </li>
                  <li>
                    Satchel finds discovered:{' '}
                    <strong className="font-mono-nums">
                      {journal.homeSummary.discoveredCount}/{journal.homeSummary.totalItemCatalogCount}
                    </strong>{' '}
                    neighborhood items
                  </li>
                  {journal.homeSummary.cottageRestCount > 0 && (
                    <li>
                      Mornings woken at home:{' '}
                      <strong className="font-mono-nums">
                        {journal.homeSummary.cottageRestCount}
                      </strong>
                    </li>
                  )}
                  {journal.homeSummary.homeRitualCount > 0 && (
                    <li>
                      Quiet tea-table moments:{' '}
                      <strong className="font-mono-nums">
                        {journal.homeSummary.homeRitualCount}
                      </strong>
                    </li>
                  )}
                </ul>
              </section>

              {/* Everyday Gameplay GA-3 — Daily Practices participation card */}
              <section
                aria-labelledby="journal-heading-practices"
                className="p-4 rounded-xl bg-card-warm border border-parchment"
              >
                <h3
                  id="journal-heading-practices"
                  className="font-display text-lg font-semibold text-espresso mb-2"
                >
                  Daily Practices
                </h3>
                <p className="font-display text-base font-semibold text-sage mb-2.5">
                  {journal.dailyPractices.keeperTitle}
                </p>
                <ul className="text-sm text-[#3D3128] space-y-1.5">
                  {journal.dailyPractices.practices.map((practice) => (
                    <li key={practice.id}>
                      {practice.label} —{' '}
                      <strong className="font-mono-nums">{practice.count}</strong> —{' '}
                      {practice.tierLabel}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 pt-2 border-t border-[#E5D9C7] text-xs text-umber leading-snug">
                  {journal.dailyPractices.touchedTodayLine}
                </p>
              </section>

              {/* Everyday Gameplay GA-1 — community contribution shelves card */}
              <section
                aria-labelledby="journal-heading-community"
                className="p-4 rounded-xl bg-card-warm border border-parchment"
              >
                <h3
                  id="journal-heading-community"
                  className="font-display text-lg font-semibold text-espresso mb-2"
                >
                  Community Shelves
                </h3>
                <p className="text-xs text-umber mb-2 leading-snug">
                  {journal.communityProjects.headline}
                </p>
                <ul className="text-sm text-[#3D3128] space-y-1.5">
                  {journal.communityProjects.lines.map((line) => (
                    <li key={line.projectId}>
                      {line.title} ({line.venueLabel}) —{' '}
                      <strong className="font-mono-nums">
                        {line.contributed}/{line.goal}
                      </strong>
                      {line.completed && (
                        <span className="font-semibold text-[#4B6B4F]"> — finished</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Places & Landmarks */}
              <section aria-labelledby="journal-heading-landmarks" className="space-y-3">
                <h3
                  id="journal-heading-landmarks"
                  className="font-display text-lg font-semibold text-espresso"
                >
                  Neighborhood Places &amp; Landmarks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {journal.landmarks.map((lm) => (
                    <article
                      key={lm.id}
                      className={`p-3.5 rounded-xl border ${
                        lm.isNew
                          ? 'bg-[#F7EFE2] border-[#D9BC96]'
                          : lm.statusKind === 'transformed'
                          ? 'bg-[#F3F5EE] border-[#CEDAC8]'
                          : 'bg-linen border-parchment'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-display text-base font-semibold text-espresso">
                          {lm.name}
                        </h4>
                        <span
                          className={`text-xs font-medium shrink-0 ${
                            lm.statusKind === 'transformed'
                              ? 'text-[#4B6B4F]'
                              : 'text-espresso-muted'
                          }`}
                        >
                          {lm.isNew ? (
                            <span className="text-terracotta-deep font-semibold">New · </span>
                          ) : null}
                          {lm.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-[#4A3C32] mt-1 leading-relaxed">
                        {lm.summary}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              {/* Player-Witnessed Moments */}
              <section aria-labelledby="journal-heading-moments" className="space-y-2.5">
                <h3
                  id="journal-heading-moments"
                  className="font-display text-lg font-semibold text-espresso"
                >
                  Recent Moments You Shaped
                </h3>
                {journal.laneMoments.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-card-warm border border-parchment text-sm text-umber">
                    Your footprints along the square, bell gazebo, and Mirror Pond will gather here as you lend a hand.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {journal.laneMoments.map((ev) => (
                      <div
                        key={ev.id}
                        className={`px-3.5 py-2.5 rounded-xl border flex items-baseline justify-between gap-3 ${
                          ev.isNew
                            ? 'bg-[#F7EFE2] border-[#D9BC96]'
                            : 'bg-card-warm border-parchment'
                        }`}
                      >
                        <p className="text-xs sm:text-sm text-[#3D3128] leading-snug">
                          {ev.isNew ? (
                            <span className="text-terracotta-deep font-semibold">New · </span>
                          ) : null}
                          {ev.summary}
                        </p>
                        <span className="text-xs text-espresso-muted font-mono-nums shrink-0">
                          Day {ev.day}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
