const DailyLog = require('../models/DailyLog')
const WeightSettings = require('../models/WeightSettings')
const { compute, invalidateWeightCache } = require('./capacityService')

// Maps factor keys to WeightSettings field names
const KEY_TO_FIELD = {
  sleepHours:     'sleepHours',
  sleepState:     'sleepState',
  mood:           'mood',
  stress:         'stress',
  napHours:       'napHours',
  napState:       'napState',
  medication:     'medication',
  prevDayTime:    'prevDayTime',
  prevDayAlcohol: 'prevDayAlcohol'
}

const pearsonCorrelation = (xs, ys) => {
  const n = xs.length
  if (n < 2) return 0
  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const sumY2 = ys.reduce((s, y) => s + y * y, 0)
  const num   = n * sumXY - sumX * sumY
  const den   = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2))
  return den === 0 ? 0 : num / den
}

const calibrate = async () => {
  // Only use days the user has rated
  const logs = await DailyLog.find({ actualCapacityRating: { $ne: null } }).sort({ date: 1 })

  if (logs.length < 7) {
    return { message: `Not enough rated days to calibrate — need at least 7, have ${logs.length}` }
  }

  // Compute capacity scores + factors for each rated day
  const dataPoints = await Promise.all(logs.map(async log => {
    const result = await compute(log.date)
    return { factors: result.factors || [], actualRating: log.actualCapacityRating }
  }))

  // For each factor key, compute Pearson correlation with the actual rating
  const correlations = {}
  for (const key of Object.keys(KEY_TO_FIELD)) {
    const pairs = dataPoints
      .map(dp => {
        const f = dp.factors.find(f => f.key === key)
        if (!f) return null
        // Use signed contribution: negative if factor hurt, positive if it helped
        const contribution = f.neutral ? 0 : f.positive ? f.impact : -f.impact
        return { x: contribution, y: dp.actualRating }
      })
      .filter(Boolean)

    if (pairs.length < 3) continue
    correlations[key] = Math.abs(pearsonCorrelation(pairs.map(p => p.x), pairs.map(p => p.y)))
  }

  if (Object.keys(correlations).length === 0) {
    return { message: 'Not enough factor data across rated days to calibrate' }
  }

  // Normalize so weights average to 1 (sum = number of factors)
  const total = Object.values(correlations).reduce((a, b) => a + b, 0)
  const factorCount = Object.keys(correlations).length
  const newWeights = {}
  for (const [key, corr] of Object.entries(correlations)) {
    // Floor at 0.1 so no factor is ever completely ignored
    newWeights[KEY_TO_FIELD[key]] = Math.max(0.1, (corr / total) * factorCount)
  }

  await WeightSettings.findOneAndUpdate({}, { ...newWeights, lastCalibrated: new Date() }, { upsert: true, returnDocument: 'after' })
  invalidateWeightCache()

  return {
    message: 'Calibration complete',
    daysUsed: logs.length,
    weights: newWeights
  }
}

module.exports = { calibrate }
