const DailyLog = require('../models/DailyLog')
const { compute } = require('./capacityService')

const predict = async () => {
  const logs = await DailyLog.find().sort({ date: -1 }).limit(7)

  if (logs.length < 7) {
    return { prediction: 'Not enough data yet — predictions appear after 7+ days of logging' }
  }

  // TODO: nap prediction (naps)
  // TODO: protein prediction (proteinLogs)
  // TODO: alcohol prediction (alcohol)

  // Compute capacity scores for the last 7 days
  const scores = await Promise.all(logs.map(log => compute(log.date)))
  const validScores = scores.filter(s => s.score !== null).map(s => s.score)

  if (!validScores.length) {
    return { prediction: 'Not enough scored data yet' }
  }

  const avg = validScores.reduce((sum, s) => sum + s, 0) / validScores.length

  // Standard deviation -- lower = more consistent = higher confidence
  const variance = validScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / validScores.length
  const stdDev = Math.sqrt(variance)

  // Confidence drops with distance and inconsistency (stdDev)
  const baseConfidence = Math.max(0, 100 - stdDev * 15)

  // Average factors across past 7 days -- group by key (not label, since labels are dynamic)
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

  const days = labels.map((label, i) => ({
    label,
    score: Math.round(avg * 100) / 100,
    confidence: Math.round(Math.max(0, baseConfidence - i * 12)),
    factors: avgFactors
  }))

  return { days }
}

module.exports = { predict }