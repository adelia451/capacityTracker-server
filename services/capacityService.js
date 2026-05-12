const DailyLog = require('../models/DailyLog')
const Task = require('../models/Task')
const WeightSettings = require('../models/WeightSettings')

const { avg } = require('../utils/math')
const { SLEEP_MAP, MOOD_MAP, STRESS_MAP, MED_QUALITY_MAP, FOCUS_QUALITY_MAP } = require('../utils/scoreMaps')
const { fmtHours, fmtMinutes } = require('../utils/timeFormat')

const MAX_MOOD            = 4
const MAX_STRESS          = 3
const MAX_SLEEP_STATE     = 2
const BASELINE_SLEEP      = 6
const MAX_SLEEP_DEVIATION = 6
const BASELINE_NAP        = 1
const MAX_NAP_DEVIATION   = 2
const MAX_MED_QUALITY     = 2
const MAX_FOCUS_QUALITY   = 2
const BASELINE_PREV_TIME  = 240  // 4 hours = neutral previous day
const MAX_PREV_TIME_DEV   = 480  // 8 hours above/below baseline

const DEFAULT_WEIGHTS = {
  sleepHours: 1, sleepState: 1, mood: 1, stress: 1,
  medication: 1, napState: 1, napHours: 1,
  prevDayTime: 1, prevDayAlcohol: 1
}

let cachedWeights = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

const getWeights = async () => {
  if (cachedWeights && Date.now() - cacheTime < CACHE_TTL) return cachedWeights
  const s = await WeightSettings.findOne()
  cachedWeights = s
    ? { sleepHours: s.sleepHours, sleepState: s.sleepState, mood: s.mood,
        stress: s.stress, medication: s.medication, napState: s.napState,
        napHours: s.napHours, prevDayTime: s.prevDayTime, prevDayAlcohol: s.prevDayAlcohol }
    : { ...DEFAULT_WEIGHTS }
  cacheTime = Date.now()
  return cachedWeights
}

const invalidateWeightCache = () => { cachedWeights = null }

const prevDateStr = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

const compute = async (date) => {
  const log = await DailyLog.findOne({ date })
  if (!log) return { date, score: null, message: 'No log found for this date' }

  const weights = await getWeights()
  let score = 0
  const factors = []

  let activeWeightSum = 0

  const addFactor = (key, label, normalized) => {
    const impact = Math.abs(normalized)
    const neutral = impact < 0.2
    factors.push({ key, label, impact, positive: !neutral && normalized >= 0, neutral })
    activeWeightSum += weights[key] ?? 1
  }

  // Sleep hours
  if (log.sleep?.hours !== undefined) {
    const normalized = Math.max(-1, Math.min(1, (log.sleep.hours - BASELINE_SLEEP) / MAX_SLEEP_DEVIATION))
    score += normalized * weights.sleepHours
    const label = normalized >= 0.2 ? `Good sleep (${fmtHours(log.sleep.hours)})`
                : normalized <= -0.2 ? `Poor sleep (${fmtHours(log.sleep.hours)})`
                : `Neutral sleep (${fmtHours(log.sleep.hours)})`
    addFactor('sleepHours', label, normalized)
  }

  // Sleep state
  if (log.sleep?.state) {
    const normalized = (SLEEP_MAP[log.sleep.state] ?? 0) / MAX_SLEEP_STATE
    score += normalized * weights.sleepState
    addFactor('sleepState', `Sleep state: ${log.sleep.state}`, normalized)
  }

  // Mood
  const allMoodValues = log.moodLogs?.map(e => e.value).filter(Boolean) || []
  if (allMoodValues.length) {
    const avgMood   = avg(allMoodValues.map(v => MOOD_MAP[v] ?? 0))
    const normalized = avgMood / MAX_MOOD
    score += normalized * weights.mood
    const counts = {}
    allMoodValues.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    addFactor('mood', `Mood: mostly ${dominant}`, normalized)
  }

  // Stress
  const allStressValues = log.stressLogs?.map(e => e.value).filter(Boolean) || []
  if (allStressValues.length) {
    const avgStress  = avg(allStressValues.map(v => STRESS_MAP[v] ?? 0))
    const normalized = avgStress / MAX_STRESS
    score += normalized * weights.stress
    const counts = {}
    allStressValues.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    addFactor('stress', `Stress: ${dominant}`, normalized)
  }

  // Naps
  if (log.naps?.length) {
    const totalNapHours = log.naps.reduce((s, n) => s + (n.hours || 0), 0)
    const napHoursNorm  = Math.max(-1, Math.min(1, (totalNapHours - BASELINE_NAP) / MAX_NAP_DEVIATION))
    score += napHoursNorm * weights.napHours
    addFactor('napHours', `Nap: ${fmtHours(totalNapHours)}`, napHoursNorm)

    const napStates    = log.naps.map(n => SLEEP_MAP[n.feltRestedAfter] ?? 0)
    const napStateNorm = avg(napStates) / MAX_SLEEP_STATE
    const stCounts = {}
    log.naps.forEach(n => { if (n.feltRestedAfter) stCounts[n.feltRestedAfter] = (stCounts[n.feltRestedAfter] || 0) + 1 })
    const domNapState = Object.entries(stCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
    addFactor('napState', `Nap state: ${domNapState}`, napStateNorm)
  }

  // Medication
  if (log.medication && !log.medication.skipped) {
    const medScores = []
    if (log.medication.medQuality) {
      medScores.push((MED_QUALITY_MAP[log.medication.medQuality] ?? 0) / MAX_MED_QUALITY)
    }
    if (log.medication.focusQuality) {
      medScores.push((FOCUS_QUALITY_MAP[log.medication.focusQuality] ?? 0) / MAX_FOCUS_QUALITY)
    }
    if (medScores.length) {
      const normalized = avg(medScores)
      score += normalized * weights.medication
      const quality = normalized >= 0.2 ? 'effective' : normalized <= -0.2 ? 'poor' : 'mild'
      addFactor('medication', `Medication: ${quality}`, normalized)
    }
  }

  // Previous day workload — more time worked yesterday = lower capacity today
  const yesterday = prevDateStr(date)
  const prevTasks = await Task.find({ date: yesterday })
  if (prevTasks.length) {
    const prevTime = prevTasks.reduce((s, t) => s + (t.timeSpent || 0), 0)
    const normalized = Math.max(-1, Math.min(1, -(prevTime - BASELINE_PREV_TIME) / MAX_PREV_TIME_DEV))
    score += normalized * weights.prevDayTime
    addFactor('prevDayTime', `Yesterday's workload (${fmtMinutes(prevTime)})`, normalized)
  }

  // Previous day alcohol
  const prevLog = await DailyLog.findOne({ date: yesterday })
  if (prevLog?.alcohol > 0) {
    const normalized = -Math.min(prevLog.alcohol / 8, 1)
    score += normalized * weights.prevDayAlcohol
    addFactor('prevDayAlcohol', `Alcohol yesterday (${prevLog.alcohol})`, normalized)
  }

  // Scale to 1–10, clamped so extreme inputs never produce out-of-range scores
  const normalizedScore = activeWeightSum > 0
    ? Math.min(10, Math.max(1, Math.round(((score / activeWeightSum + 1) / 2 * 9 + 1) * 10) / 10))
    : null

  return {
    date,
    score: normalizedScore,
    factors
  }
}

module.exports = { compute, invalidateWeightCache }
