const router = require('express').Router()
const capacityService = require('../services/capacityService')
const insightService = require('../services/insightService')
const predictionService = require('../services/predictionService')

router.get('/capacity', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10)
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

module.exports = router
