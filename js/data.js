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
    { id: 'bench',      name: 'Bench Press',              short: 'Bench',       cat: 'chest',     kind: 'load', std: 'bench', star: true, aka: ['flat bench', 'barbell bench'] },
    { id: 'incline',    name: 'Incline Bench Press',      short: 'Incline',     cat: 'chest',     kind: 'load', std: 'incline', aka: ['incline barbell'] },
    { id: 'dbbench',    name: 'Dumbbell Bench Press',     short: 'DB Bench',    cat: 'chest',     kind: 'db',   std: 'dbbench', aka: ['db bench', 'dumbbell press'] },
    { id: 'inclinedb',  name: 'Incline Dumbbell Press',   short: 'Incline DB',  cat: 'chest',     kind: 'db',   std: 'inclinedb', aka: ['incline db'] },
    { id: 'dip',        name: 'Dip',                      short: 'Dip',         cat: 'chest',     kind: 'bw',   std: 'dip', aka: ['dips', 'chest dip', 'tricep dip'] },
    { id: 'chestpress', name: 'Machine Chest Press',      short: 'Chest Press', cat: 'chest',     kind: 'load', std: 'chestpress', aka: ['chest press', 'hammer strength press'] },
    { id: 'pecdeck',    name: 'Pec Deck',                 short: 'Pec Deck',    cat: 'chest',     kind: 'load', std: 'pecdeck', aka: ['machine fly', 'chest fly machine', 'butterfly'] },
    { id: 'closegrip',  name: 'Close-Grip Bench Press',   short: 'CGBP',        cat: 'chest',     kind: 'load', std: 'closegrip', aka: ['close grip bench', 'cgbp'] },
    { id: 'cablefly',   name: 'Cable Fly',                short: 'Cable Fly',   cat: 'chest',     kind: 'load', aka: ['cable crossover', 'chest fly'] },

    { id: 'ohp',        name: 'Overhead Press',           short: 'OHP',         cat: 'shoulders', kind: 'load', std: 'ohp', star: true, aka: ['military press', 'shoulder press', 'standing press', 'barbell press'] },
    { id: 'dbpress',    name: 'Dumbbell Shoulder Press',  short: 'DB Press',    cat: 'shoulders', kind: 'db',   std: 'dbpress', aka: ['db shoulder press', 'seated dumbbell press'] },
    { id: 'arnold',     name: 'Arnold Press',             short: 'Arnold',      cat: 'shoulders', kind: 'db',   std: 'arnold' },
    { id: 'lateral',    name: 'Lateral Raise',            short: 'Lat Raise',   cat: 'shoulders', kind: 'db',   std: 'lateral', aka: ['side raise', 'side lateral raise', 'dumbbell lateral raise'] },

    { id: 'row',        name: 'Barbell Row',              short: 'Row',         cat: 'back',      kind: 'load', std: 'row', star: true, aka: ['bent over row', 'barbell bent over row', 'pendlay row'] },
    { id: 'pullup',     name: 'Pull-up',                  short: 'Pull-up',     cat: 'back',      kind: 'bw',   std: 'pullup', aka: ['pullups', 'pull ups'] },
    { id: 'chinup',     name: 'Chin-up',                  short: 'Chin-up',     cat: 'back',      kind: 'bw',   std: 'chinup', aka: ['chinups', 'chin ups'] },
    { id: 'pulldown',   name: 'Lat Pulldown',             short: 'Pulldown',    cat: 'back',      kind: 'load', std: 'pulldown', aka: ['lat pull', 'pull down'] },
    { id: 'cablerow',   name: 'Seated Cable Row',         short: 'Cable Row',   cat: 'back',      kind: 'load', std: 'cablerow', aka: ['cable row', 'seated row', 'low row'] },
    { id: 'dbrow',      name: 'Dumbbell Row',             short: 'DB Row',      cat: 'back',      kind: 'db',   std: 'dbrow', aka: ['one arm row', 'single arm row', 'db row'] },

    { id: 'tbarrow',    name: 'T-Bar Row',                short: 'T-Bar Row',   cat: 'back',      kind: 'load', std: 'tbarrow', aka: ['tbar row', 'landmine row'] },
    { id: 'shrug',      name: 'Barbell Shrug',            short: 'Shrug',       cat: 'back',      kind: 'load', std: 'shrug', aka: ['shrugs', 'trap shrug'] },

    { id: 'squat',      name: 'Back Squat',               short: 'Squat',       cat: 'legs',      kind: 'load', std: 'squat', star: true, aka: ['squat', 'barbell squat'] },
    { id: 'frontsquat', name: 'Front Squat',              short: 'Front Squat', cat: 'legs',      kind: 'load', std: 'frontsquat' },
    { id: 'legpress',   name: 'Leg Press',                short: 'Leg Press',   cat: 'legs',      kind: 'load', std: 'legpress', aka: ['leg press machine'] },
    { id: 'hacksquat',  name: 'Hack Squat',               short: 'Hack Squat',  cat: 'legs',      kind: 'load', std: 'hacksquat', aka: ['machine hack squat'] },
    { id: 'smithsquat', name: 'Smith Machine Squat',      short: 'Smith Squat', cat: 'legs',      kind: 'load', std: 'smithsquat', aka: ['smith squat'] },
    { id: 'goblet',     name: 'Goblet Squat',             short: 'Goblet',      cat: 'legs',      kind: 'load', std: 'goblet', aka: ['dumbbell squat', 'kettlebell squat'] },
    { id: 'bulgarian',  name: 'Bulgarian Split Squat',    short: 'Bulgarian',   cat: 'legs',      kind: 'db',   std: 'bulgarian', aka: ['split squat', 'bss'] },
    { id: 'legext',     name: 'Leg Extension',            short: 'Leg Ext',     cat: 'legs',      kind: 'load', std: 'legext', aka: ['quad extension', 'knee extension'] },
    { id: 'calf',       name: 'Calf Raise (Machine)',     short: 'Calves',      cat: 'legs',      kind: 'load', std: 'calf', aka: ['calf raise', 'standing calf raise', 'calves'] },

    { id: 'deadlift',   name: 'Deadlift',                 short: 'Deadlift',    cat: 'hinge',     kind: 'load', std: 'deadlift', star: true, aka: ['conventional deadlift', 'barbell deadlift'] },
    { id: 'rdl',        name: 'Romanian Deadlift',        short: 'RDL',         cat: 'hinge',     kind: 'load', std: 'rdl', aka: ['rdl', 'romanian', 'stiff leg deadlift', 'stiff legged deadlift', 'sldl'] },
    { id: 'hipthrust',  name: 'Hip Thrust',               short: 'Hip Thrust',  cat: 'hinge',     kind: 'load', std: 'hipthrust', aka: ['glute bridge', 'barbell hip thrust'] },
    { id: 'sumo',       name: 'Sumo Deadlift',            short: 'Sumo',        cat: 'hinge',     kind: 'load', std: 'sumo', aka: ['sumo'] },
    { id: 'trapbar',    name: 'Trap Bar Deadlift',        short: 'Trap Bar',    cat: 'hinge',     kind: 'load', std: 'trapbar', aka: ['hex bar deadlift', 'hex bar'] },
    { id: 'lyingcurl',  name: 'Lying Leg Curl',           short: 'Lying Curl',  cat: 'hinge',     kind: 'load', std: 'lyingcurl', aka: ['hamstring curl', 'leg curl', 'prone leg curl'] },
    { id: 'legcurl',    name: 'Seated Leg Curl',          short: 'Leg Curl',    cat: 'hinge',     kind: 'load', std: 'legcurl', aka: ['hamstring curl', 'leg curl', 'seated hamstring curl'] },

    { id: 'curl',       name: 'Barbell Curl',             short: 'Curl',        cat: 'arms',      kind: 'load', std: 'curl', aka: ['bicep curl', 'biceps curl', 'ez bar curl'] },
    { id: 'dbcurl',     name: 'Dumbbell Curl',            short: 'DB Curl',     cat: 'arms',      kind: 'db',   std: 'dbcurl', aka: ['bicep curl', 'db curl'] },
    { id: 'pushdown',   name: 'Tricep Pushdown',          short: 'Pushdown',    cat: 'arms',      kind: 'load', std: 'pushdown', aka: ['tricep pushdown', 'cable pushdown', 'rope pushdown'] },
    { id: 'hammercurl', name: 'Hammer Curl',              short: 'Hammer',      cat: 'arms',      kind: 'db',   std: 'hammercurl' },
    { id: 'preacher',   name: 'Preacher Curl',            short: 'Preacher',    cat: 'arms',      kind: 'load', std: 'preacher', aka: ['ez preacher curl', 'scott curl'] },
    { id: 'skullcrusher', name: 'Skull Crusher',          short: 'Skulls',      cat: 'arms',      kind: 'load', std: 'skullcrusher', aka: ['lying tricep extension', 'french press', 'ez bar extension'] },
  ];

  return { TIERS, CATEGORIES, EXERCISES };
})();
