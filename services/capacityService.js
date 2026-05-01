const DailyLog = require('../models/DailyLog')

const moodMap = {
  depressed: -4, heavy: -3, sad: -2, meh: -1,
  neutral: 0, positive: 1, happy: 2
}

const stressMap = {
  understimulated: -1, 'stress-free': 1, balanced: 2,
  debilitating: -2, paralyzing: -3
}

const sleepMap = {
  sleepy: -2, tired: -1, neutral: 0, awake: 1, energized: 2
}

const medQualityMap = {
  'no effect': -2, 'lightly felt': -1, 'felt': 1, 'strongly felt': 2
}

const focusQualityMap = {
  'unfocused': -1, 'focused': 1, 'locked-in': 2
}

// Normalization constants
const MAX_MOOD = 4
const MAX_STRESS = 3
const MAX_SLEEP_STATE = 2
const BASELINE_SLEEP = 6
const MAX_SLEEP_DEVIATION = 6
const BASELINE_NAP = 1
const MAX_NAP_DEVIATION = 2
const MAX_MED_QUALITY = 2
const MAX_FOCUS_QUALITY = 2

// These will eventually be learned
const weights = {
  sleepHours: 1,
  sleepState: 1,
  mood: 1,
  stress: 1,
  medication: 1,
  napState: 1,
  napHours: 1
  //protein
  //alcohol
}

const compute = async (date) => {
  const log = await DailyLog.findOne({ date })
  if (!log) return { date, score: null, message: 'No log found for this date' }

  let score = 0
  const factors = []

  // Sleep hours - centered baseline
  if (log.sleep?.hours !== undefined) {
    const normalized = (log.sleep.hours - BASELINE_SLEEP) / MAX_SLEEP_DEVIATION
    score += normalized * weights.sleepHours
    factors.push({ label: 'Sleep hours', impact: Math.abs(normalized), positive: normalized >= 0 })
  }

  // Sleep state
  if (log.sleep?.state) {
    const normalized = (sleepMap[log.sleep.state] ?? 0) / MAX_SLEEP_STATE
    score += normalized * weights.sleepState
    factors.push({ label: 'Sleep state', impact: Math.abs(normalized), positive: normalized >= 0 })
  }

  // Mood
  if (log.moodLogs?.length) {
    const avgMood = log.moodLogs.reduce((sum, e) => sum + (moodMap[e.value] ?? 0), 0) / log.moodLogs.length
    const normalized = avgMood / MAX_MOOD
    score += normalized * weights.mood
    factors.push({ label: 'Mood', impact: Math.abs(normalized), positive: normalized >= 0 })
  }

  // Stress
  if (log.stressLogs?.length) {
    const avgStress = log.stressLogs.reduce((sum, e) => sum + (stressMap[e.value] ?? 0), 0) / log.stressLogs.length
    const normalized = avgStress / MAX_STRESS
    score += normalized * weights.stress
    factors.push({ label: 'Stress', impact: Math.abs(normalized), positive: normalized >= 0 })
  }

  // Nap hours and state
  if (log.naps?.length) {
    const avgNapHours = log.naps.reduce((sum, nap) => sum + (nap.hours || 0), 0) / log.naps.length
    const napHoursNorm = (avgNapHours - BASELINE_NAP) / MAX_NAP_DEVIATION
    score += napHoursNorm * weights.napHours
    factors.push({ label: 'Nap hours', impact: Math.abs(napHoursNorm), positive: napHoursNorm >= 0 })

    const avgNapState = log.naps.reduce((sum, nap) => sum + (sleepMap[nap.feltRestedAfter] ?? 0), 0) / log.naps.length
    const napStateNorm = avgNapState / MAX_SLEEP_STATE
    score += napStateNorm * weights.napState
    factors.push({ label: 'Nap state', impact: Math.abs(napStateNorm), positive: napStateNorm >= 0 })
  }

  // Medication
  if (log.medication && !log.medication.skipped) {
    const scores = []
    if (log.medication.medQuality?.length) {
      const avg = log.medication.medQuality.reduce((sum, q) => sum + (medQualityMap[q] ?? 0), 0) / log.medication.medQuality.length
      scores.push(avg / MAX_MED_QUALITY)
    }
    if (log.medication.focusQuality?.length) {
      const avg = log.medication.focusQuality.reduce((sum, q) => sum + (focusQualityMap[q] ?? 0), 0) / log.medication.focusQuality.length
      scores.push(avg / MAX_FOCUS_QUALITY)
    }
    if (scores.length) {
      const normalized = scores.reduce((sum, s) => sum + s, 0) / scores.length
      score += normalized * weights.medication
      factors.push({ label: 'Medication', impact: Math.abs(normalized), positive: normalized >= 0 })
    }
  }

  return {
    date,
    score: Math.round(score * 100) / 100,
    factors
  }
}

module.exports = { compute }