import React, { useState } from 'react';
import { BookOpen, Check, Clock, Heart, MapPin, Users, X } from 'lucide-react';
import { RESIDENTS, RESIDENT_ORDER, getResidentScheduleSlot, getTimePhase } from '../game/residents';
import { getResidentAvailableQuestCue } from '../game/narrative';
import { composeEnvironmentState, getWeatherLabel } from '../game/environment';
import {
  getEmotionLabel,
  getRelationshipTier,
  getRelationshipTierLabel,
  moodToEmotion,
} from '../game/relationships';
import { WorldState } from '../game/types';

interface JournalDrawerProps {
  open: boolean;
  world: WorldState;
  onClose: () => void;
  onAdvanceTime: () => void;
}

export const JournalDrawer: React.FC<JournalDrawerProps> = ({
  open,
  world,
  onClose,
  onAdvanceTime,
}) => {
  const [tab, setTab] = useState<'residents' | 'story' | 'guide'>('residents');

  if (!open) return null;

  const phase = getTimePhase(world.minuteOfDay);
  const composed = composeEnvironmentState(world);
  const env = composed.playerChanges;

  const storyThreads = [
    {
      id: 'mystery',
      title: 'The Quiet Gazebo Bell',
      done: world.flags.heardBellMystery,
      hint: 'Speak with Pip in the plaza or Nora at Linden Book Nook.',
    },
    {
      id: 'ivy',
      title: 'Clear the Gazebo Rafters',
      done: world.flags.clearedGazeboIvy,
      hint: 'Ask Barnaby at Pinecone Woodshop about borrowing his cedar ladder.',
    },
    {
      id: 'clapper',
      title: 'Recover the Brass Clapper',
      done: world.flags.foundBrassClapper,
      hint: 'Follow Toby’s clue near the Hollow Oak root by Mirror Pond.',
    },
    {
      id: 'bridge',
      title: 'Soften Old Silences (Postcard or Tea)',
      done: world.flags.deliveredPostcard || world.flags.brewedChamomileTea || world.flags.claraArthurReconciled,
      hint: 'Help Jun deliver Nora’s coastal postcard, or ask Sora for chamomile-pear tea.',
    },
    {
      id: 'bell',
      title: 'Ring the Restored Bell Together',
      done: world.flags.bellRestored,
      hint: 'Bring the clapper & clear rafters news to Arthur at Copperwheel Cottage.',
    },
  ];

  const completedThreads = storyThreads.filter((t) => t.done).length;
  const sf = world.sideFlags ?? {};
  const personalThreads = [
    {
      id: 'side_zine',
      title: 'Pip & Nora’s Willow Lane Zine',
      done: Boolean(sf.pipZinePrinted),
      started: Boolean(sf.pipZineStarted),
      hint: sf.pipZineStarted
        ? 'Check in with Nora at Linden Book Nook to stitch Issue #1.'
        : 'Build a warm chat with Pip (1+ heart) to hear his zine idea.',
    },
    {
      id: 'side_herbloaf',
      title: 'Mina & Clara’s Lemon-Thyme Loaf',
      done: Boolean(sf.herbLoafShared),
      started: Boolean(sf.herbLoafStarted),
      hint: sf.herbLoafStarted
        ? 'Visit Clara at Hearth & Crumb to share the herb sourdough.'
        : 'Chat with Mina (1+ heart) about her grafted lemon-thyme.',
    },
    {
      id: 'side_stand',
      title: 'Sora & Barnaby’s Pond Music Stand',
      done: Boolean(sf.pondStandBuilt),
      started: Boolean(sf.pondStandStarted),
      hint: sf.pondStandStarted
        ? 'Ask Barnaby at Pinecone Woodshop to plane the cedar stand.'
        : 'Visit Sora (1+ heart) to hear why her sheet music drifts.',
    },
    {
      id: 'side_watch',
      title: 'Jun & Arthur’s Pocket Watch',
      done: Boolean(sf.watchTuneFinished),
      started: Boolean(sf.watchTuneStarted),
      hint: sf.watchTuneStarted
        ? 'Ask Arthur at Copperwheel Cottage to oil Jun’s brass escapement.'
        : 'Chat with Jun after helping deliver Nora’s coastal postcard.',
    },
  ];

  const tabIds: Array<'residents' | 'story' | 'guide'> = ['residents', 'story', 'guide'];

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number,
  ) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % tabIds.length;
    else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + tabIds.length) % tabIds.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabIds.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = tabIds[nextIdx];
      setTab(nextTab);
      const targetBtn = document.getElementById(`journal-tab-${nextTab}`);
      targetBtn?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-[#2D241E]/45 pointer-events-auto">
      <div
        role="dialog"
        aria-label="Pocket Journal"
        className="w-full max-w-3xl max-h-[86vh] bg-[#FAF5EC] border border-[#D4C4AE] rounded-2xl shadow-[0_20px_56px_rgba(45,36,30,0.28)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5D9C7]">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2D241E]">
              Pocket Journal
            </h2>
            <p className="text-xs text-[#6A5B50] mt-0.5 leading-snug">
              Day {world.day} ({composed.season.seasonLabel}) · {phase.charAt(0).toUpperCase() + phase.slice(1)} · {getWeatherLabel(composed.weather.effective)} · {world.memories.length} {world.memories.length === 1 ? 'Memory' : 'Memories'} Saved
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close journal"
            className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-[#6A5B50] hover:bg-[#EFE5D5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Controls */}
        <div
          role="tablist"
          aria-label="Journal sections"
          className="px-3 sm:px-5 pt-2.5 sm:pt-3 pb-2 border-b border-[#EFE5D6] grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2"
        >
          <button
            id="journal-tab-residents"
            type="button"
            role="tab"
            aria-selected={tab === 'residents'}
            aria-controls="journal-tabpanel"
            tabIndex={tab === 'residents' ? 0 : -1}
            onClick={() => setTab('residents')}
            onKeyDown={(e) => handleTabKeyDown(e, 0)}
            className={`min-w-0 w-full sm:w-auto min-h-[48px] sm:min-h-[44px] px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm leading-tight font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center transition-colors cursor-pointer sm:whitespace-nowrap sm:shrink-0 ${
              tab === 'residents'
                ? 'bg-[#C86446] text-[#FAF5EC]'
                : 'bg-[#F1E8D9] text-[#4E4036] hover:bg-[#E7DAC5]'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="max-w-full">Neighbors ({RESIDENT_ORDER.length})</span>
          </button>
          <button
            id="journal-tab-story"
            type="button"
            role="tab"
            aria-selected={tab === 'story'}
            aria-controls="journal-tabpanel"
            tabIndex={tab === 'story' ? 0 : -1}
            onClick={() => setTab('story')}
            onKeyDown={(e) => handleTabKeyDown(e, 1)}
            className={`min-w-0 w-full sm:w-auto min-h-[48px] sm:min-h-[44px] px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm leading-tight font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center transition-colors cursor-pointer sm:whitespace-nowrap sm:shrink-0 ${
              tab === 'story'
                ? 'bg-[#C86446] text-[#FAF5EC]'
                : 'bg-[#F1E8D9] text-[#4E4036] hover:bg-[#E7DAC5]'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="max-w-full">Story &amp; Memories ({completedThreads}/5)</span>
          </button>
          <button
            id="journal-tab-guide"
            type="button"
            role="tab"
            aria-selected={tab === 'guide'}
            aria-controls="journal-tabpanel"
            tabIndex={tab === 'guide' ? 0 : -1}
            onClick={() => setTab('guide')}
            onKeyDown={(e) => handleTabKeyDown(e, 2)}
            className={`min-w-0 w-full sm:w-auto min-h-[48px] sm:min-h-[44px] px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm leading-tight font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center transition-colors cursor-pointer sm:whitespace-nowrap sm:shrink-0 ${
              tab === 'guide'
                ? 'bg-[#C86446] text-[#FAF5EC]'
                : 'bg-[#F1E8D9] text-[#4E4036] hover:bg-[#E7DAC5]'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="max-w-full">World &amp; Time</span>
          </button>
        </div>

        {/* Body */}
        <div
          id="journal-tabpanel"
          role="tabpanel"
          aria-labelledby={`journal-tab-${tab}`}
          className="flex-1 overflow-y-auto storybook-scroll p-4 sm:p-5 space-y-4"
        >
          {tab === 'residents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {RESIDENT_ORDER.map((id) => {
                const def = RESIDENTS[id];
                const prog = world.residents[id];
                const slot = getResidentScheduleSlot(id, phase, env.reconciledTogether);
                const runtime = world.npcRuntime?.[id];
                const rel = world.playerRelations?.[id];
                const affinity = rel?.affinity ?? prog.trust * 20;
                const tierLabel = getRelationshipTierLabel(getRelationshipTier(affinity));
                const emotion = runtime?.emotion ?? rel?.lastEmotion ?? moodToEmotion(prog.mood);
                const emotionLabel = getEmotionLabel(emotion);
                const reliability = rel?.reliability ?? 25;
                const cue = getResidentAvailableQuestCue(id, world);
                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full shrink-0 border-2 border-[#FAF5EC] flex items-center justify-center font-display font-bold text-[#FAF5EC]"
                          style={{ backgroundColor: def.appearance.coatColor }}
                        >
                          {def.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h3 className="font-display text-lg font-semibold text-[#2D241E]">
                              {def.name}
                            </h3>
                            {cue !== 'none' && (
                              <span className="text-xs font-semibold text-[#B45539]">
                                · Story waiting
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6A5B50]">
                            {def.role} · {prog.met ? def.homeName : 'New face'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0" aria-label={`Trust ${prog.trust} of 5`}>
                        {[0, 1, 2, 3, 4].map((idx) => (
                          <Heart
                            key={idx}
                            className={`w-3.5 h-3.5 ${
                              idx < prog.trust
                                ? 'fill-[#C86446] text-[#C86446]'
                                : 'fill-transparent text-[#C7B7A2]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-[#3D3128] leading-snug">
                      {def.personality}
                    </p>

                    <div className="pt-2 border-t border-[#E5D9C7] text-xs text-[#5E5046] flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-[#6A5B50]">
                        <span>
                          {tierLabel} · {emotionLabel}
                        </span>
                        <span className="font-mono-nums">Reliability {reliability}%</span>
                      </div>
                      <span className="font-medium truncate">
                        Now: {runtime?.currentPlaceName ?? slot.placeName} — {runtime?.currentActivityLabel ?? slot.activity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'story' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#2D241E] mb-3">
                  The Silent Gazebo Bell — Neighborhood Storyline
                </h3>
                <div className="space-y-2.5">
                  {storyThreads.map((step) => (
                    <div
                      key={step.id}
                      className="p-3.5 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] flex items-start gap-3"
                    >
                      <div
                        className={`w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center border ${
                          step.done
                            ? 'bg-[#5E8062] border-[#5E8062] text-[#FAF5EC]'
                            : 'bg-[#FAF5EC] border-[#C9B8A3] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${step.done ? 'text-[#2D241E]' : 'text-[#4E4036]'}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-[#6A5B50] mt-0.5">
                          {step.done ? 'Completed in the neighborhood' : step.hint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display text-lg font-semibold text-[#2D241E] mb-3">
                  Personal Stories &amp; Kindnesses
                </h3>
                <div className="space-y-2.5">
                  {personalThreads.map((step) => (
                    <div
                      key={step.id}
                      className="p-3.5 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] flex items-start gap-3"
                    >
                      <div
                        className={`w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center border ${
                          step.done
                            ? 'bg-[#5E8062] border-[#5E8062] text-[#FAF5EC]'
                            : step.started
                            ? 'bg-[#E5A93C]/25 border-[#C86446] text-[#C86446]'
                            : 'bg-[#FAF5EC] border-[#C9B8A3] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${step.done ? 'text-[#2D241E]' : 'text-[#4E4036]'}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-[#6A5B50] mt-0.5">
                          {step.done ? 'Shared along the lane' : step.hint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display text-lg font-semibold text-[#2D241E] mb-3">
                  Recorded Memories
                </h3>
                <div className="space-y-2.5">
                  {world.memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3.5 rounded-xl bg-[#FAF5EC] border border-[#E2D4C0]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-display text-base font-semibold text-[#2D241E]">
                          {mem.title}
                        </h4>
                        <span className="text-xs text-[#6A5B50] font-mono-nums shrink-0">
                          Day {mem.day} · {mem.phase}
                        </span>
                      </div>
                      <p className="text-sm text-[#4A3C32] mt-1 leading-relaxed">
                        {mem.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {world.worldEvents && world.worldEvents.length > 0 && (
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#2D241E] mb-3">
                    Recent Lane Moments
                  </h3>
                  <div className="space-y-2">
                    {world.worldEvents.slice(0, 5).map((ev) => (
                      <div
                        key={ev.id}
                        className="px-3.5 py-2.5 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] flex items-center justify-between gap-3"
                      >
                        <p className="text-xs sm:text-sm text-[#3D3128] leading-snug">
                          {ev.summary}
                        </p>
                        <span className="text-xs text-[#6A5B50] font-mono-nums shrink-0">
                          Day {ev.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'guide' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#2D241E]">
                    Watch the Neighborhood Shift
                  </h3>
                  <p className="text-sm text-[#5E5046] mt-0.5">
                    Neighbors walk between cottages, the plaza, and Mirror Pond across Morning, Afternoon, Golden Hour, and Lantern Dusk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAdvanceTime();
                    onClose();
                  }}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-[#5E8062] hover:bg-[#4F6E53] text-sm font-semibold text-[#FAF5EC] flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Clock className="w-4 h-4" />
                  <span>Advance 2 Hours</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0]">
                <h3 className="font-display text-lg font-semibold text-[#2D241E] mb-2">
                  Sky, Season & Neighborhood Rhythm
                </h3>
                <ul className="text-sm text-[#3D3128] space-y-1.5">
                  <li>
                    Season:{' '}
                    <strong>
                      {composed.season.seasonLabel} — Day {composed.season.dayOfSeason} of 10, Year{' '}
                      {composed.season.year}
                    </strong>
                  </li>
                  <li>
                    Today&apos;s sky:{' '}
                    <strong>
                      {getWeatherLabel(composed.weather.effective)}
                      {composed.weather.current === 'misty_morning' &&
                      composed.weather.effective === 'misty_morning'
                        ? ' (clearing mid-morning)'
                        : ''}
                    </strong>
                  </li>
                  <li>
                    Tomorrow&apos;s forecast:{' '}
                    <strong>{getWeatherLabel(composed.weather.tomorrowForecast)}</strong>
                  </li>
                  <li>
                    Plaza noticeboard flyers:{' '}
                    <strong className="font-mono-nums">
                      {composed.npcTouches.noticeboardFlyerCount}/3
                    </strong>{' '}
                    posted
                  </li>
                  <li>
                    Sunbeam Greenhouse bloom stage:{' '}
                    <strong className="font-mono-nums">
                      Stage {composed.npcTouches.minaGreenhouseStage}/3
                    </strong>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#F4ECE0] border border-[#E2D4C0]">
                <h3 className="font-display text-lg font-semibold text-[#2D241E] mb-2">
                  Environmental Reactivity
                </h3>
                <ul className="text-sm text-[#3D3128] space-y-1.5">
                  <li>
                    Window-box planters blooming: <strong className="font-mono-nums">{env.plantersBloomed}/3</strong>
                  </li>
                  <li>
                    Stone plaza fountain: <strong>{env.fountainFlowing ? 'Flowing with clear water' : 'Quiet until valve is cleared'}</strong>
                  </li>
                  <li>
                    Old Bell Gazebo: <strong>{env.bellGleaming ? 'Restored & chiming' : env.ivyCleared ? 'Ivy cleared, awaiting brass clapper' : 'Wrapped in creeping ivy'}</strong>
                  </li>
                  <li>
                    Bakery café tables & plaza lanterns: <strong>{env.bakeryTablesOpen ? 'Open in the sunlit lane' : 'Waiting on Clara & Arthur'}</strong>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
