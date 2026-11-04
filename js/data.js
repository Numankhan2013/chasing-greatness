/* Tiers, muscle groups and the exercise catalogue.
 *
 * Ranks are percentile-based (8 tiers: Rookie → Bronze → Silver → Gold → Diamond → Elite → Legend → Mythic): "stronger than X% of lifters" at your bodyweight and sex,
 * using the Strength Level standards in standards.js. Each tier (except Mythic) has three
 * divisions — III → II → I — so there's always a next step in sight.
 */
window.CG_DATA = (() => {
  // `from` = percentile floor. Experience notes follow Strength Level's level descriptions.
  const TIERS = [
    // Matte iron: you're on the ladder. Then real metals, then the prestige tiers.
    { id: 'rookie',  ink: '#52525b', name: 'Rookie',  from: 0,    color: '#8b8f98', c2: '#3f4249', blurb: 'Learning the movements. The fastest gains of your life are right ahead.', exp: 'First months of training' },
    { id: 'bronze',  ink: '#9a4b17', name: 'Bronze',  from: 20,   color: '#d4884a', c2: '#7a3f17', blurb: 'A real foundation. Stronger than 1 in 5 people who lift.', exp: 'Typical after ~6–12 months' },
    { id: 'silver',  ink: '#475569', name: 'Silver',  from: 33.3, color: '#dfe5ee', c2: '#7d8798', blurb: 'Solid, consistent strength. You\'re pulling away from beginners.', exp: 'Typical after ~1–2 years' },
    { id: 'gold',    ink: '#a16207', name: 'Gold',    from: 46.7, color: '#ffd25e', c2: '#a86f0c', blurb: 'Stronger than the average gym-goer. That takes real work.', exp: 'Typical after ~2–3 years' },
    { id: 'diamond', ink: '#0369a1', name: 'Diamond', from: 60,   color: '#8fd8ff', c2: '#1f6fa8', blurb: 'Stronger than most people who lift. People notice.', exp: 'Typical after ~3–5 years' },
    { id: 'elite',   ink: '#047857', name: 'Elite',   from: 80,   color: '#4ee6b0', c2: '#0b7a58', blurb: 'Top 20% of lifters. Years of dedicated, smart training.', exp: 'Typical after 5+ years' },
    { id: 'legend',  ink: '#6d28d9', name: 'Legend',  from: 90,   color: '#b49bff', c2: '#5a3fc4', blurb: 'Top 10%. This is competitive-level strength.', exp: 'Competitive lifters' },
    { id: 'mythic',  ink: '#be123c', name: 'Mythic',  from: 97,   color: '#ff5a7a', c2: '#a1123a', blurb: 'Top 3% of lifters. Genuinely rare air.', exp: 'Top competitors' },
  ];

  const CATEGORIES = [
    { id: 'chest',     name: 'Chest',     weight: 1 },
    { id: 'shoulders', name: 'Shoulders', weight: 1 },
    { id: 'back',      name: 'Back',      weight: 1 },
    { id: 'legs',      name: 'Legs',      weight: 1 },
    { id: 'hinge',     name: 'Posterior', weight: 1, long: 'Glutes & hamstrings' },
    { id: 'arms',      name: 'Arms',      weight: 0.5 },
  ];

  // kind: 'load' (barbell/machine 1RM), 'db' (per dumbbell), 'bw' (bodyweight reps; weight = added load).
  const EXERCISES = [
    { id: 'bench',      name: 'Bench Press',              short: 'Bench',       cat: 'chest',     kind: 'load', std: 'bench', star: true },
    { id: 'incline',    name: 'Incline Bench Press',      short: 'Incline',     cat: 'chest',     kind: 'load', std: 'incline' },
    { id: 'dbbench',    name: 'Dumbbell Bench Press',     short: 'DB Bench',    cat: 'chest',     kind: 'db',   std: 'dbbench' },
    { id: 'inclinedb',  name: 'Incline Dumbbell Press',   short: 'Incline DB',  cat: 'chest',     kind: 'db',   std: 'inclinedb' },
    { id: 'dip',        name: 'Dip',                      short: 'Dip',         cat: 'chest',     kind: 'bw',   std: 'dip' },
    { id: 'cablefly',   name: 'Cable Fly',                short: 'Cable Fly',   cat: 'chest',     kind: 'load' },

    { id: 'ohp',        name: 'Overhead Press',           short: 'OHP',         cat: 'shoulders', kind: 'load', std: 'ohp', star: true },
    { id: 'dbpress',    name: 'Dumbbell Shoulder Press',  short: 'DB Press',    cat: 'shoulders', kind: 'db',   std: 'dbpress' },
    { id: 'lateral',    name: 'Lateral Raise',            short: 'Lat Raise',   cat: 'shoulders', kind: 'db' },

    { id: 'row',        name: 'Barbell Row',              short: 'Row',         cat: 'back',      kind: 'load', std: 'row', star: true },
    { id: 'pullup',     name: 'Pull-up',                  short: 'Pull-up',     cat: 'back',      kind: 'bw',   std: 'pullup' },
    { id: 'chinup',     name: 'Chin-up',                  short: 'Chin-up',     cat: 'back',      kind: 'bw',   std: 'chinup' },
    { id: 'pulldown',   name: 'Lat Pulldown',             short: 'Pulldown',    cat: 'back',      kind: 'load', std: 'pulldown' },
    { id: 'cablerow',   name: 'Seated Cable Row',         short: 'Cable Row',   cat: 'back',      kind: 'load', std: 'cablerow' },
    { id: 'dbrow',      name: 'Dumbbell Row',             short: 'DB Row',      cat: 'back',      kind: 'db',   std: 'dbrow' },

    { id: 'squat',      name: 'Back Squat',               short: 'Squat',       cat: 'legs',      kind: 'load', std: 'squat', star: true },
    { id: 'frontsquat', name: 'Front Squat',              short: 'Front Squat', cat: 'legs',      kind: 'load', std: 'frontsquat' },
    { id: 'legpress',   name: 'Leg Press',                short: 'Leg Press',   cat: 'legs',      kind: 'load', std: 'legpress' },
    { id: 'legext',     name: 'Leg Extension',            short: 'Leg Ext',     cat: 'legs',      kind: 'load' },
    { id: 'calf',       name: 'Calf Raise',               short: 'Calves',      cat: 'legs',      kind: 'load' },

    { id: 'deadlift',   name: 'Deadlift',                 short: 'Deadlift',    cat: 'hinge',     kind: 'load', std: 'deadlift', star: true },
    { id: 'rdl',        name: 'Romanian Deadlift',        short: 'RDL',         cat: 'hinge',     kind: 'load', std: 'rdl' },
    { id: 'hipthrust',  name: 'Hip Thrust',               short: 'Hip Thrust',  cat: 'hinge',     kind: 'load', std: 'hipthrust' },
    { id: 'legcurl',    name: 'Leg Curl',                 short: 'Leg Curl',    cat: 'hinge',     kind: 'load' },

    { id: 'curl',       name: 'Barbell Curl',             short: 'Curl',        cat: 'arms',      kind: 'load', std: 'curl' },
    { id: 'dbcurl',     name: 'Dumbbell Curl',            short: 'DB Curl',     cat: 'arms',      kind: 'db',   std: 'dbcurl' },
    { id: 'pushdown',   name: 'Tricep Pushdown',          short: 'Pushdown',    cat: 'arms',      kind: 'load', std: 'pushdown' },
  ];

  return { TIERS, CATEGORIES, EXERCISES };
})();
