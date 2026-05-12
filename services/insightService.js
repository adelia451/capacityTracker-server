const DailyLog = require('../models/DailyLog')
const { compute } = require('./capacityService')
const { avg } = require('../utils/math')
const { fmtHours } = require('../utils/timeFormat')

const sleepInsights = (logs) => {
  const withSleep = logs.filter(l => l.sleep?.hours != null)
  if (!withSleep.length) return []
  const mean = avg(withSleep.map(l => l.sleep.hours))
  if (mean < 6) return [`Your average sleep is ${fmtHours(mean)} — below the minimum needed for reliable capacity. Low sleep is likely your biggest score drag.`]
  if (mean < 7) return [`Your average sleep is ${fmtHours(mean)} — functional but on the low side.`]
  return [`Your average sleep is ${fmtHours(mean)}, which is in a healthy range.`]
}

const burnoutInsights = (scores) => {
  // HIGH = 7 on a 1–10 scale (above-average capacity day)
  const HIGH = 7
  const recent = scores.slice(-14)
  let streak = 0
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i] != null && recent[i] > HIGH) streak++
    else break
  }
  if (streak >= 4) return [`You have had ${streak} high-output days in a row. A capacity dip may be coming — consider building in some recovery time.`]
  return []
}

const generate = async () => {
  const logs = await DailyLog.find().sort({ date: 1 })

  if (logs.length < 7) {
    return ['Not enough data yet — insights appear after 7+ days of logging']
  }

  const scoreResults = await Promise.all(logs.map(l => compute(l.date)))
  const scoreArr = scoreResults.map(r => r.score)

  // TODO: nap insights (naps)
  // TODO: protein insights (proteinLogs)
  // TODO: alcohol insights (alcohol)

  return [
    ...sleepInsights(logs),
    ...burnoutInsights(scoreArr)
  ].filter(Boolean)
}

module.exports = { generate }
