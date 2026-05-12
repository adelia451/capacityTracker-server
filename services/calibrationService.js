const DailyLog = require('../models/DailyLog')
const WeightSettings = require('../models/WeightSettings')
const { compute, invalidateWeightCache } = require('./capacityService')
const { pearson } = require('../utils/math')

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

const calibrate = async () => {
  const logs = await DailyLog.find({ actualCapacityRating: { $ne: null } }).sort({ date: 1 })

  if (logs.length < 7) {
    return { message: `Not enough rated days to calibrate — need at least 7, have ${logs.length}` }
  }

  const dataPoints = await Promise.all(logs.map(async log => {
    const result = await compute(log.date)
    return { factors: result.factors || [], actualRating: log.actualCapacityRating }
  }))

  const correlations = {}
  for (const key of Object.keys(KEY_TO_FIELD)) {
    const pairs = dataPoints
      .map(dp => {
        const f = dp.factors.find(f => f.key === key)
        if (!f) return null
        const contribution = f.neutral ? 0 : f.positive ? f.impact : -f.impact
        return { x: contribution, y: dp.actualRating }
      })
      .filter(Boolean)

    if (pairs.length < 3) continue
    const { r } = pearson(pairs.map(p => p.x), pairs.map(p => p.y))
    if (r === null) continue
    correlations[key] = Math.abs(r)
  }

  if (Object.keys(correlations).length === 0) {
    return { message: 'Not enough factor data across rated days to calibrate' }
  }

  // Normalize so weights average to 1
  const total = Object.values(correlations).reduce((a, b) => a + b, 0)
  const factorCount = Object.keys(correlations).length
  const newWeights = {}
  for (const [key, corr] of Object.entries(correlations)) {
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
