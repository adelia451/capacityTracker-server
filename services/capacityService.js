// services/capacityService.js
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

  // Sleep hours - centered baseline
  if (log.sleep?.hours !== undefined) {
    const centered = log.sleep.hours - BASELINE_SLEEP
    const normalized = centered / MAX_SLEEP_DEVIATION   // ~ -1 to 1
    score += normalized * weights.sleepHours
  }

  // Sleep state
  if (log.sleep?.state) {
    const raw = sleepMap[log.sleep.state] ?? 0
    const normalized = raw / MAX_SLEEP_STATE
    score += normalized * weights.sleepState
  }

  // Mood 
  if (log.moodLogs?.length) {
    const avgMood =
      log.moodLogs.reduce((sum, entry) => {
        return sum + (moodMap[entry.value] ?? 0)
      }, 0) / log.moodLogs.length

    const normalized = avgMood / MAX_MOOD
    score += normalized * weights.mood
  }

  // Stress 
  if (log.stressLogs?.length) {
    const avgStress =
      log.stressLogs.reduce((sum, entry) => {
        return sum + (stressMap[entry.value] ?? 0)
      }, 0) / log.stressLogs.length

    const normalized = avgStress / MAX_STRESS
    score += normalized * weights.stress
  }

  // Nap hours and state (averaged across all naps if multiple)
  if (log.naps?.length) {
    const avgNapHours =
      log.naps.reduce((sum, nap) => sum + (nap.hours || 0), 0) / log.naps.length
    const centeredNap = avgNapHours - BASELINE_NAP
    score += (centeredNap / MAX_NAP_DEVIATION) * weights.napHours

    const avgNapState =
      log.naps.reduce((sum, nap) => sum + (sleepMap[nap.feltRestedAfter] ?? 0), 0) / log.naps.length
    score += (avgNapState / MAX_SLEEP_STATE) * weights.napState
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
    }
  }

  return {
    date,
    score: Math.round(score * 100) / 100
  }
}

module.exports = { compute }