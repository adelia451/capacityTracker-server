const DailyLog = require('../models/DailyLog')
const Task = require('../models/Task')
const { compute } = require('./capacityService')
const { getCorrelationInsights } = require('./correlationService')

// --- rule-based helpers (always useful regardless of data volume) ---

const dominant = (arr) => {
  if (!arr.length) return null
  const counts = {}
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

const sleepInsights = (logs) => {
  const withSleep = logs.filter(l => l.sleep?.hours != null)
  if (!withSleep.length) return []
  const mean = avg(withSleep.map(l => l.sleep.hours))
  if (mean < 6) return [`Your average sleep is ${mean.toFixed(1)} hours -- below the minimum needed for reliable capacity. Low sleep is likely your biggest score drag.`]
  if (mean < 7) return [`Your average sleep is ${mean.toFixed(1)} hours -- functional but on the low side.`]
  return [`Your average sleep is ${mean.toFixed(1)} hours, which is in a healthy range.`]
}

const burnoutInsights = (scores) => {
  const HIGH = 1.5
  const recent = scores.slice(-14)
  let streak = 0
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i] != null && recent[i] > HIGH) streak++
    else break
  }
  if (streak >= 4) return [`You have had ${streak} high-output days in a row. A capacity dip may be coming -- consider building in some recovery time.`]
  return []
}

// --- main export ---

const generate = async () => {
  const logs = await DailyLog.find().sort({ date: 1 })

  if (logs.length < 7) {
    return ['Not enough data yet -- insights appear after 7+ days of logging']
  }

  // Compute capacity scores for all logs upfront (single pass)
  const scoreResults = await Promise.all(logs.map(l => compute(l.date)))
  const scoreMap = {}
  logs.forEach((l, i) => { scoreMap[l.date] = scoreResults[i].score })
  const scoreArr = scoreResults.map(r => r.score)

  // Group all tasks by date for correlation engine
  const allTasks = await Task.find()
  const tasksByDate = {}
  allTasks.forEach(t => {
    if (!tasksByDate[t.date]) tasksByDate[t.date] = []
    tasksByDate[t.date].push(t)
  })

  // Rule-based insights (useful from day 7)
  const insights = [
    ...sleepInsights(logs),
    ...burnoutInsights(scoreArr)
  ]

  // Correlation-discovered patterns (needs 10+ days to be meaningful)
  const correlationInsights = getCorrelationInsights(logs, scoreMap, tasksByDate)
  insights.push(...correlationInsights)

  // TODO: nap insights (naps)
  // TODO: protein insights (proteinLogs)
  // TODO: alcohol insights (alcohol)

  return insights.filter(Boolean)
}

module.exports = { generate }
