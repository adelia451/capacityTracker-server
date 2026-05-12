const DailyLog = require('../models/DailyLog')
const { compute } = require('./capacityService')
const { avg } = require('../utils/math')

const predict = async () => {
  const logs = await DailyLog.find().sort({ date: -1 }).limit(7)

  if (logs.length < 7) {
    return { prediction: 'Not enough data yet — predictions appear after 7+ days of logging' }
  }

  const scores = await Promise.all(logs.map(log => compute(log.date)))
  const validScores = scores.filter(s => s.score !== null).map(s => s.score)

  if (!validScores.length) {
    return { prediction: 'Not enough scored data yet' }
  }

  const meanScore = avg(validScores)

  // Simple trend: compare the more recent half of the window against the older half
  const half = Math.floor(validScores.length / 2)
  const trendDelta = half > 0
    ? avg(validScores.slice(0, half)) - avg(validScores.slice(half))
    : 0

  const variance = validScores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / validScores.length
  const stdDev = Math.sqrt(variance)
  const baseConfidence = Math.max(0, 100 - stdDev * 15)

  const allFactors = scores.flatMap(s => s.factors || [])
  const factorKeys = [...new Set(allFactors.map(f => f.key))]
  const avgFactors = factorKeys.map(key => {
    const matching = allFactors.filter(f => f.key === key)
    const avgImpact = matching.reduce((sum, f) => sum + f.impact, 0) / matching.length
    const positiveCount = matching.filter(f => f.positive).length
    const neutralCount  = matching.filter(f => f.neutral).length
    const neutral = neutralCount >= matching.length / 2
    return {
      key,
      label: matching[matching.length - 1]?.label || key,
      impact: Math.round(avgImpact * 100) / 100,
      positive: !neutral && positiveCount >= matching.length / 2,
      neutral
    }
  })

  const labels = ['Tomorrow', 'Day after', 'In 3 days']

  // Project forward using the recent trend, damped so it doesn't overshoot
  const days = labels.map((label, i) => ({
    label,
    score: Math.min(10, Math.max(1, Math.round((meanScore + trendDelta * (i + 1) * 0.25) * 10) / 10)),
    confidence: Math.round(Math.max(0, baseConfidence - i * 12)),
    factors: avgFactors
  }))

  return { days }
}

module.exports = { predict }
