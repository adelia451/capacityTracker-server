const DailyLog = require('../models/DailyLog')

const predict = async () => {
  const logs = await DailyLog.find().sort({ date: -1 }).limit(7)

  if (logs.length < 7) {
    return { prediction: 'Not enough data yet — predictions appear after 7+ days of logging' }
  }

  // TODO: protein prediction (proteinLogs)
  // TODO: nap prediction (naps - hours, feltRestedAfter)
  // TODO: alcohol prediction (alcohol)

  const avgSleep =
    logs.reduce((sum, log) => sum + (log.sleep?.hours || 0), 0) / logs.length

  return {
    prediction: `You are likely to sleep around ${avgSleep.toFixed(1)} hours`
  }
}

module.exports = { predict }