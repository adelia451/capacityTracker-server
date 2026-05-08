const router = require('express').Router()
const capacityService = require('../services/capacityService')
const insightService = require('../services/insightService')
const predictionService = require('../services/predictionService')
const calibrationService = require('../services/calibrationService')
const { getCorrelationInsights } = require('../services/correlationService')
const DailyLog = require('../models/DailyLog')
const Task = require('../models/Task')

router.get('/capacity', async (req, res) => {
  try {
    const date = req.query.date || new Date().toLocaleDateString('en-CA')
    const result = await capacityService.compute(date)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/insights', async (req, res) => {
  try {
    const result = await insightService.generate()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/prediction', async (req, res) => {
  try {
    const result = await predictionService.predict()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/correlations', async (req, res) => {
  try {
    const logs = await DailyLog.find().sort({ date: 1 })
    if (logs.length < 10) return res.json([])
    const scoreResults = await Promise.all(logs.map(l => capacityService.compute(l.date)))
    const scoreMap = {}
    logs.forEach((l, i) => { scoreMap[l.date] = scoreResults[i].score })
    const allTasks = await Task.find()
    const tasksByDate = {}
    allTasks.forEach(t => {
      if (!tasksByDate[t.date]) tasksByDate[t.date] = []
      tasksByDate[t.date].push(t)
    })
    const insights = getCorrelationInsights(logs, scoreMap, tasksByDate)
    res.json(insights)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/calibrate', async (req, res) => {
  try {
    const result = await calibrationService.calibrate()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
