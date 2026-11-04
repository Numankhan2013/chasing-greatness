/* Tiers, muscle groups and the exercise catalogue.
 *
 * Ranks are percentile-based: "stronger than X% of lifters" at your bodyweight and sex,
 * using the Strength Level standards in standards.js. Each tier (except Mythic) has three
 * divisions — III → II → I — so there's always a next step in sight.
 */
window.CG_DATA = (() => {
  // `from` = percentile floor. Experience notes follow Strength Level's level descriptions.
  const TIERS = [
    { id: 'rookie', ink: '#64748b',    name: 'Rookie',    from: 0,  color: '#9aa3b5', c2: '#5d6577', blurb: 'Learning the movements. The fastest gains of your life are right ahead.', exp: 'First months of training' },
    { id: 'contender', ink: '#c2410c', name: 'Contender', from: 20, color: '#e0915a', c2: '#8a4a22', blurb: 'A real foundation. Stronger than 1 in 5 people who lift.', exp: 'Typical after ~6–12 months' },
    { id: 'warrior', ink: '#475569',   name: 'Warrior',   from: 40, color: '#d6dde8', c2: '#7b8698', blurb: 'Around or above the average gym-goer. That takes consistency.', exp: 'Typical after ~1–2 years' },
    { id: 'champion', ink: '#b45309',  name: 'Champion',  from: 60, color: '#ffd25e', c2: '#a86f0c', blurb: 'Stronger than most people who lift. People notice.', exp: 'Typical after ~2–5 years' },
    { id: 'elite', ink: '#0f766e',     name: 'Elite',     from: 80, color: '#4ee6d6', c2: '#0c7d78', blurb: 'Top 20% of lifters. Years of dedicated, smart training.', exp: 'Typical after 5+ years' },
    { id: 'legend', ink: '#6d28d9',    name: 'Legend',    from: 90, color: '#b49bff', c2: '#5a3fc4', blurb: 'Top 10%. This is competitive-level strength.', exp: 'Competitive lifters' },
    { id: 'mythic', ink: '#be123c',    name: 'Mythic',    from: 97, color: '#ff5a7a', c2: '#a1123a', blurb: 'Top 3% of lifters. Genuinely rare air.', exp: 'Top competitors' },
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
