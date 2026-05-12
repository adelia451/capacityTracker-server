const SLEEP_MAP = { sleepy: -2, tired: -1, neutral: 0, awake: 1, energized: 2 }
const MOOD_MAP = { depressed: -4, heavy: -3, sad: -2, meh: -1, neutral: 0, positive: 1, happy: 2 }
const STRESS_MAP = { understimulated: -1, 'stress-free': 1, balanced: 2, debilitating: -2, paralyzing: -3 }
const MED_QUALITY_MAP = { 'no effect': -2, 'lightly felt': -1, 'felt': 1, 'strongly felt': 2 }
const FOCUS_QUALITY_MAP = { 'unfocused': -1, 'focused': 1, 'locked-in': 2 }

module.exports = { SLEEP_MAP, MOOD_MAP, STRESS_MAP, MED_QUALITY_MAP, FOCUS_QUALITY_MAP }
