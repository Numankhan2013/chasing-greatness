/* Exercise catalogue + strength standards.
 *
 * Standards are 1RM / bodyweight ratios, one per tier (7 tiers).
 * They're adapted from widely published barbell strength standards
 * (beginner → world-class), stretched across seven tiers.
 * `f` is the multiplier applied for female lifters.
 */
window.CG_DATA = (() => {
  const TIERS = [
    { name: 'Rookie',    color: '#9aa4b2', glyph: 'I',   blurb: 'You showed up. That already beats most people.' },
    { name: 'Contender', color: '#d08a4c', glyph: 'II',  blurb: 'The basics are locked in. Momentum is building.' },
    { name: 'Warrior',   color: '#c9d3e0', glyph: 'III', blurb: 'Stronger than most people who walk into a gym.' },
    { name: 'Champion',  color: '#f5c542', glyph: 'IV',  blurb: 'Years of consistent work show. People notice.' },
    { name: 'Elite',     color: '#37d6c8', glyph: 'V',   blurb: 'Competitive-level strength. Rare air.' },
    { name: 'Legend',    color: '#a98bff', glyph: 'VI',  blurb: 'Top-percentile strength. Stories get told.' },
    { name: 'Mythic',    color: '#ff4d6d', glyph: 'VII', blurb: 'World-class. Rarer than unicorns.' },
  ];
  const UNRANKED = { name: 'Unranked', color: '#5b6472', glyph: '·', blurb: 'Log a lift to get ranked.' };

  const EXERCISES = [
    // Ranked lifts — the big five.
    { id: 'bench',    name: 'Bench Press',    group: 'Ranked lifts', ranked: true, short: 'Bench',
      std: [0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00], f: 0.62 },
    { id: 'squat',    name: 'Back Squat',     group: 'Ranked lifts', ranked: true, short: 'Squat',
      std: [0.75, 1.00, 1.25, 1.50, 1.75, 2.25, 2.75], f: 0.76 },
    { id: 'deadlift', name: 'Deadlift',       group: 'Ranked lifts', ranked: true, short: 'Deadlift',
      std: [1.00, 1.25, 1.50, 1.75, 2.25, 2.75, 3.00], f: 0.78 },
    { id: 'ohp',      name: 'Overhead Press', group: 'Ranked lifts', ranked: true, short: 'OHP',
      std: [0.35, 0.50, 0.65, 0.80, 1.00, 1.15, 1.30], f: 0.62 },
    { id: 'row',      name: 'Barbell Row',    group: 'Ranked lifts', ranked: true, short: 'Row',
      std: [0.50, 0.65, 0.85, 1.00, 1.25, 1.50, 1.75], f: 0.66 },

    // Accessories — tracked, charted, not ranked.
    { id: 'incline',   name: 'Incline Bench Press',   group: 'Push' },
    { id: 'dbbench',   name: 'Dumbbell Bench Press',  group: 'Push' },
    { id: 'dip',       name: 'Weighted Dip',          group: 'Push' },
    { id: 'dbpress',   name: 'Dumbbell Shoulder Press', group: 'Push' },
    { id: 'pullup',    name: 'Weighted Pull-up',      group: 'Pull' },
    { id: 'pulldown',  name: 'Lat Pulldown',          group: 'Pull' },
    { id: 'cablerow',  name: 'Seated Cable Row',      group: 'Pull' },
    { id: 'curl',      name: 'Barbell Curl',          group: 'Pull' },
    { id: 'frontsquat',name: 'Front Squat',           group: 'Legs' },
    { id: 'rdl',       name: 'Romanian Deadlift',     group: 'Legs' },
    { id: 'legpress',  name: 'Leg Press',             group: 'Legs' },
    { id: 'hipthrust', name: 'Hip Thrust',            group: 'Legs' },
  ];

  return { TIERS, UNRANKED, EXERCISES };
})();
