// Static game data: stats, skills, perks, jobs, achievements, themes.

export const STATS = {
  STR: { name: 'Strength', cls: 'Warrior' },
  VIT: { name: 'Vitality', cls: 'Guardian' },
  WIS: { name: 'Wisdom', cls: 'Monk' },
  CHA: { name: 'Charisma', cls: 'Bard' },
  WIL: { name: 'Willpower', cls: 'Ascetic' },
  INT: { name: 'Intellect', cls: 'Sage' }
};
export const STAT_KEYS = Object.keys(STATS);

export const STAT_INFO = {
  STR: ['Physical training and effort. Anything that makes your body stronger or more capable.', 'Workout, bouldering, run, push-ups, sports'],
  VIT: ['Body maintenance and energy. Sleep, food, water, sunlight, and recovery.', 'Sleep routine, morning light, cook a real meal, drink water, stretch'],
  WIS: ['Inner calm and self-awareness. Training your mind to be present instead of on autopilot.', 'Meditation, journaling, gratitude list, therapy, a walk without your phone'],
  CHA: ['Expression and connection. Making things other people see, socializing, putting yourself out there.', 'Post a TikTok, film or edit a video, call a friend, go to an event, practice music or art'],
  WIL: ['Self-control. Resisting the easy dopamine and doing the hard thing anyway.', 'No phone in bed, no scrolling, cold shower, chores you avoid, waking up on time'],
  INT: ['Learning and building your mind. Reading, studying, picking up skills, planning your future.', 'Read 10 pages, study, homework, job applications, learn a language, budgeting']
};

// keyword -> stat, used to suggest a stat from the quest name. [pattern, stat, weight]
export const STAT_KEYWORDS = [
  [/no (phone|screen|scroll|social)|phone.*(down|away)|don'?t (use|touch|check)|without (my |your |a )?phone|resist|avoid|quit|cold shower|discipline|chore|laundry|dishes|clean|tidy|alarm|wake up|get up|on time|no (sugar|junk|alcohol|weed|vap)/i, 'WIL', 3],
  [/meditat|mindful|breath|journal|gratitude|reflect|therap|pray|calm|healthy minds|headspace|waking up app|self.?care|affirm/i, 'WIS', 3],
  [/sleep|asleep|bed ?time|nap\b/i, 'VIT', 4],
  [/water|hydrat|eat|meal|cook|protein|fruit|veg|breakfast|lunch|dinner|sun|light|stretch|yoga|skincare|shower|vitamin|floss|teeth|walk|steps|rest|doctor/i, 'VIT', 2],
  [/work ?out|gym|lift|boulder|climb|run\b|running|jog|push.?up|pull.?up|chin.?up|squat|exercise|train|cardio|swim|bike|cycl|hike|sport|basketball|soccer|football|tennis|calisthen|plank|abs\b|core|planche|handstand|dip/i, 'STR', 3],
  [/tiktok|post|upload|video|edit|film|record|youtube|instagram|content|stream|call|text|friend|social|talk|date|network|speak|reach out|family|message|club|event|party|guitar|piano|music|sing|draw|paint|art\b|design|photo|dance|creat|fl studio/i, 'CHA', 2],
  [/read|study|learn|book|course|homework|class|lecture|code|coding|program|language|duolingo|spanish|french|math|research|flashcard|anki|job|apply|resume|interview|budget|financ|invest|plan|essay|exam|notes|driv/i, 'INT', 2]
];

export const DIFF = {
  easy: { xp: 10, pts: 1, label: 'Easy' },
  normal: { xp: 20, pts: 2, label: 'Normal' },
  hard: { xp: 35, pts: 3, label: 'Hard' }
};

export const SKILL_REQ = [15, 25, 45, 80, 130, 210];
export const MASTERY_STEP = 100;
export const SKILL_BONUS = 0.02;    // +2% XP on that stat's quests per unlocked skill
export const MASTERY_BONUS = 0.01;  // +1% per mastery rank

// [name, flavor, signature perk or null]. Signature perks sit on the 3rd and 6th skill of each line.
export const SKILLS = {
  STR: [['Clenched Fist', 'The body remembers effort.'], ['Iron Grip', 'Hands that do not let go.'],
    ['Stone Skin', 'Soreness becomes a formality.', 'Hard quests give +10% XP.'],
    ['Titan\'s Back', 'A silhouette sharpened by repetition.'], ['Unbreakable Frame', 'Fatigue asks permission first.'],
    ['Monarch of Might', 'Strength is simply who you are now.', 'Weekly quest completion bonuses +50%.']],
  VIT: [['Well Rested', 'Sleep restores 10% more HP.'], ['Sunborn', 'Morning light charges your mana.'],
    ['Regeneration', 'Bad days recover faster.', 'You are immune to the Fatigued debuff.'],
    ['Circadian Lock', 'Your clock runs on your terms.'], ['Everflame Heart', 'Energy that doesn\'t crash.'],
    ['Undying', 'Nothing drains you for long.', 'Hold up to 3 streak shields instead of 2.']],
  WIS: [['Deep Breath', 'A pause before the reaction.'], ['Still Water', 'Racing thoughts slow when observed.'],
    ['Mind\'s Eye', 'You notice the drift and return.', 'Daily journal entries give double XP.'],
    ['Calm Aura', 'Anxiety debuffs last half as long.'], ['Present Moment', 'Here, now, fully.'],
    ['Unshakable Mind', 'The storm passes. You stay.', 'Perfect clear bonus +50%.']],
  CHA: [['First Upload', 'You hit post. That\'s the hard part.'], ['Hook Craft', 'The first 2 seconds belong to you.'],
    ['Crowd Sense', 'You feel what lands.', 'Your 3rd and 4th side quests each day give full XP.'],
    ['Silver Tongue', 'Words come easier.'], ['Viral Spark', 'Something you made spreads.'],
    ['Main Character', 'You create instead of scroll.', 'Side quests give +15% XP.']],
  WIL: [['Resist Temptation', 'The phone stays down. Once.'], ['Iron Will', 'The phone stays down. Again.'],
    ['Dopamine Ward', 'Cheap rewards lose their pull.', 'Streak XP bonus cap raised from +50% to +60%.'],
    ['Discipline Engine', 'You act before you feel like it.'], ['Stoic Core', 'Urges are noticed, not obeyed.'],
    ['Absolute Resolve', 'Your word to yourself is law.', 'Earn a shield every 6 streak days instead of 7.']],
  INT: [['Quick Study', 'New info sticks a little better.'], ['Focus Lens', 'Distractions blur at the edges.'],
    ['Analysis', 'Problems break into pieces.', 'Timed quests that reach their goal give +10% XP.'],
    ['Memory Palace', 'What you learn, you keep.'], ['Polymath', 'Every field connects.'],
    ['Sage\'s Insight', 'You see the pattern first.', '+5% XP on everything.']]
};

export const TITLES = [[0, 'Wanderer'], [3, 'Awakened'], [7, 'Apprentice of Routine'], [14, 'The Disciplined'], [30, 'Unbroken'], [60, 'Ascendant'], [100, 'Living Legend'], [180, 'Mythic'], [365, 'Monarch']];
export const RANKS = [[1, 'F'], [5, 'E'], [10, 'D'], [20, 'C'], [27, 'B'], [40, 'A'], [55, 'S'], [75, 'SS'], [110, 'SSS'], [150, 'EX']];

// Jobs: chosen from your top stats at every 10th level. Tier rises at Lv25 and Lv50.
export const JOB_TIERS = [[10, 0.05], [25, 0.08], [50, 0.12]];   // [level, XP bonus on the job's two stats]
export const JOBS = {
  'STR+VIT': ['Death Knight', 'Dreadnought', 'Warbringer', 'Armor that never breaks, a body that never stops.'],
  'STR+WIS': ['Shadow Fist', 'Void Monk', 'Godslayer', 'Strikes from a perfectly still mind.'],
  'STR+CHA': ['Executioner', 'Blood Champion', 'Tyrant', 'Power that wants an audience, and gets one.'],
  'STR+WIL': ['Berserker', 'Reaver', 'Calamity', 'Pain is just information.'],
  'STR+INT': ['Hexblade', 'Runeslayer', 'Void Saint', 'A cursed blade guided by a cold mind.'],
  'VIT+WIS': ['Necromancer', 'Lich', 'Grave Monarch', 'Commands the body\'s decay through ritual and discipline.'],
  'VIT+CHA': ['Vampire', 'Nosferatu', 'Progenitor', 'Undying energy and a presence people can\'t look away from.'],
  'VIT+WIL': ['Inquisitor', 'Dread Templar', 'Hierophant', 'Discipline enforced on the flesh.'],
  'VIT+INT': ['Plague Doctor', 'Plaguebringer', 'Pestilence', 'Treats the body like an experiment.'],
  'WIS+CHA': ['Phantom', 'Specter', 'Nightmare Lord', 'Calm, unseen, and somehow everywhere at once.'],
  'WIS+WIL': ['Shade', 'Umbral Knight', 'Shadow Monarch', 'Stillness as a weapon. The shadows answer.'],
  'WIS+INT': ['Occultist', 'Grimoire Keeper', 'Void Sage', 'Forbidden knowledge, held calmly.'],
  'CHA+WIL': ['Warlord', 'Overlord', 'Dark Emperor', 'Leads by doing the hard thing first.'],
  'CHA+INT': ['Puppeteer', 'Mind Flayer', 'Fate Weaver', 'Reads people and pulls the strings.'],
  'WIL+INT': ['Assassin', 'Nightblade', 'Angel of Death', 'Patient, precise, never seen coming.']
};

export const BUFFS = {
  rested:    { name: 'Well-Rested', icon: '☾', good: true, bonus: 0.05, desc: 'Night quest done 3 nights in a row. +5% XP today.' },
  onfire:    { name: 'On Fire', icon: '✦', good: true, bonus: 0.05, desc: '3 perfect days in a row. +5% XP today.' },
  focused:   { name: 'Focused', icon: '◎', good: true, bonus: 0.05, desc: '60+ minutes on the timer yesterday. +5% XP today.' },
  refreshed: { name: 'Refreshed', icon: '❖', good: true, bonus: 0.05, desc: 'Just checked out of the Inn. +5% XP today.' },
  fatigued:  { name: 'Fatigued', icon: '▼', good: false, bonus: -0.10, desc: 'Your last active day was missed or saved by a shield. -10% XP until you clear a day.' }
};

export const INN_PER_MONTH = 3;
export const JOURNAL_XP = 5;

export const THEMES = [
  ['system', 'The System', 'Blue holographic status windows. The original.'],
  ['demon', 'Demon Lord', 'Crimson and black. Villain arc energy.'],
  ['arcane', 'Arcane Void', 'Purple mana and cosmic vibes.'],
  ['guild', 'Adventurer\'s Guild', 'Parchment quest board. Light mode.'],
  ['blessing', 'Goddess\'s Blessing', 'Holy gold and pearl. The goddess who reincarnated you is watching.'],
  ['shadow', 'Shadow Sovereign', 'Violet shadow mist at the edges. Arise.'],
  ['sakura', 'Sakura Shrine', 'Washi paper, ink, and vermilion. Light mode.'],
  ['frost', 'Frost Citadel', 'Frosted glass under a slow aurora.'],
  ['celestial', 'Celestial Observatory', 'Each finished quest lights a star in tonight\'s constellation.'],
  ['dragon', 'Dragon\'s Hoard', 'Emerald scales and molten gold. Finished quests turn to coin.'],
  ['abyss', 'Abyssal Depths', 'Bioluminescence in the deep. Quests rise like light.'],
  ['ronin', 'Ronin at Dusk', 'Amber sunset, ink mountains, brushstroke bars.'],
  ['vrmmo', 'Virtual Dungeon', 'Clean VRMMO HUD. Link start.'],
  ['eclipse', 'Eclipse', 'A black sun with a pale corona over near-black.'],
  ['bloodmoon', 'Blood Moon', 'A huge dim red moon rising behind everything.'],
  ['rift', 'Void Rift', 'A glowing tear in black space, slowly breathing.'],
  ['wraith', 'Wraith', 'Pale fog drifting over cold blue-black.'],
  ['forge', 'Obsidian Forge', 'Volcanic glass, lava cracks, rising embers.'],
  ['ghostlights', 'Ghost Lights', 'A faint dark aurora of green and violet over black.'],
  ['ashfall', 'Ashfall', 'Grey ash drifting down over charcoal. Blackletter and bone.'],
  ['monarch', 'Monarch\'s Shadow', 'Violet smoke rising from below. Your army waits.'],
  ['frostbound', 'Frostbound', 'Glacier ice rising from the dark, cold light glowing through it.']
];

// Achievements. test(ctx) runs against compute() output plus helpers. Some are hidden until earned.
// title: optional selectable title the achievement grants.
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Step', desc: 'Complete your first quest.', test: c => c.totalDone >= 1 },
  { id: 'q100', name: 'Centurion', desc: 'Complete 100 quests.', test: c => c.totalDone >= 100 },
  { id: 'q500', name: 'Quest Machine', desc: 'Complete 500 quests.', test: c => c.totalDone >= 500, title: 'Quest Machine' },
  { id: 'q1000', name: 'Thousand Deeds', desc: 'Complete 1,000 quests.', test: c => c.totalDone >= 1000, title: 'Doer of a Thousand Deeds' },
  { id: 'perfect1', name: 'Flawless', desc: 'Get your first perfect clear.', test: c => c.perfect >= 1 },
  { id: 'perfect7', name: 'Seven Seals', desc: '7 perfect days.', test: c => c.perfect >= 7 },
  { id: 'perfect30', name: 'Immaculate', desc: '30 perfect days.', test: c => c.perfect >= 30, title: 'The Immaculate' },
  { id: 'streak7', name: 'One Week Strong', desc: 'Reach a 7-day streak.', test: c => c.best >= 7 },
  { id: 'streak30', name: 'Unbroken Month', desc: 'Reach a 30-day streak.', test: c => c.best >= 30 },
  { id: 'streak100', name: 'Hundred Days', desc: 'Reach a 100-day streak.', test: c => c.best >= 100, title: 'The Hundred-Day Hero' },
  { id: 'lv10', name: 'Awakened Power', desc: 'Reach level 10.', test: c => c.level >= 10 },
  { id: 'lv25', name: 'Elite', desc: 'Reach level 25.', test: c => c.level >= 25 },
  { id: 'lv50', name: 'Half-Century', desc: 'Reach level 50.', test: c => c.level >= 50, title: 'Veteran of Fifty' },
  { id: 'rankS', name: 'S-Rank Hunter', desc: 'Reach S rank.', test: c => c.level >= 55, title: 'S-Rank Hunter' },
  { id: 'devoted', name: 'Devoted', desc: 'Keep a single quest\'s streak going for 30 days.', test: c => c.bestQuestStreak >= 30, title: 'The Devoted' },
  { id: 'weekly4', name: 'Weekly Warrior', desc: 'Hit a weekly quest\'s target 4 weeks in a row.', test: c => c.bestWeeklyStreak >= 4 },
  { id: 'side25', name: 'Side Hustle', desc: 'Complete 25 side quests.', test: c => c.sideDone >= 25 },
  { id: 'rounded', name: 'Well-Rounded', desc: 'Get every stat to 50.', test: c => Math.min(...Object.values(c.stats)) >= 50, title: 'The Well-Rounded' },
  { id: 'stat100', name: 'Specialist', desc: 'Get any stat to 100.', test: c => Math.max(...Object.values(c.stats)) >= 100 },
  { id: 'sixfold', name: 'Six-Fold Path', desc: 'Unlock all 6 skills in one line.', test: c => Math.max(...Object.values(c.stats)) >= SKILL_REQ[5] },
  { id: 'mastery', name: 'Master', desc: 'Reach Mastery I in any line.', test: c => Math.max(...Object.values(c.stats)) >= SKILL_REQ[5] + MASTERY_STEP, title: 'Grandmaster' },
  { id: 'job', name: 'Class Change', desc: 'Choose your first job.', test: c => c.hasJob },
  { id: 'journal7', name: 'Chronicler', desc: 'Write a journal entry on 7 days.', test: c => c.journalDays >= 7 },
  { id: 'journal30', name: 'Lorekeeper', desc: 'Write a journal entry on 30 days.', test: c => c.journalDays >= 30, title: 'Lorekeeper' },
  { id: 'time10', name: 'Deep Work', desc: 'Track 10 hours on quest timers.', test: c => c.timeTotal >= 36000 },
  { id: 'time100', name: 'Timekeeper', desc: 'Track 100 hours on quest timers.', test: c => c.timeTotal >= 360000, title: 'Timekeeper' },
  { id: 'inn', name: 'Well Traveled', desc: 'Stay a night at the Inn.', test: c => c.innDays >= 1 },
  { id: 'shields', name: 'Shield Bearer', desc: 'Hold 2 shields at once.', test: c => c.maxShieldsHeld >= 2 },
  { id: 'fashion', name: 'Fashionista', desc: 'Equip 5 different themes.', test: c => c.themesTried >= 5 },
  { id: 'comeback', name: 'Comeback Arc', desc: 'Clear a day right after a missed one.', hidden: true, test: c => c.comeback, title: 'Comeback Kid' },
  { id: 'nightowl', name: 'Night Shift', desc: 'Check off a quest after midnight, before the day resets.', hidden: true, test: c => c.nightOwl },
  { id: 'overpowered', name: 'Overpowered', desc: 'Have 3 buffs active at once.', hidden: true, test: c => c.maxBuffs >= 3, title: 'The Overpowered' }
];
