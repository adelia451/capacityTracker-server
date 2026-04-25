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

// Normalization constants
const MAX_MOOD = 4
const MAX_STRESS = 3
const MAX_SLEEP_STATE = 2
const BASELINE_SLEEP = 6
const MAX_SLEEP_DEVIATION = 6  // assumes 0–12 hours typical
const MAX_MED_QUALITY = 5      // assuming scale 0–5

// These will eventually be learned 
const weights = {
  sleepHours: 1,
  sleepState: 1,
  mood: 1,
  stress: 1,
  medication: 1
  //protein
  //napHours
  //napState
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

  // Medication
 if (log.medication) {
    const quality = log.medication.feltQuality ?? 0
    const normalized = quality / MAX_MED_QUALITY
    score += normalized * weights.medication
  }

  return {
    date,
    score: Math.round(score * 100) / 100
  }
}

module.exports = { compute }