const DailyLog = require('../models/DailyLog')

const generate = async () => {
  const logs = await DailyLog.find().sort({ date: 1 })

  if (logs.length < 7) {
    return ['Not enough data yet — insights appear after 7+ days of logging']
  }

  const insights = []

  // TODO: nap insights (naps)
  // TODO: protein insights (proteinLogs)
  // TODO: alcohol insights (alcohol)

  const avgSleep =
    logs.reduce((sum, log) => sum + (log.sleep?.hours || 0), 0) / logs.length

  if (avgSleep < 6) {
    insights.push('You tend to get less than 6 hours of sleep on average')
  } else {
    insights.push('Your sleep is generally in a healthy range')
  }

  return insights
}

module.exports = { generate }