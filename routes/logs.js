// created the router
const router = require('express').Router()
// imported the model
const DailyLog = require('../models/dailyLog')

// post
router.post('/', async (req, res) => {
  try {
    const log = new DailyLog(req.body) //
    await log.save()    //takes incoming json and saves it
    res.status(201).json(log)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const logs = await DailyLog.find().sort({ date: -1 }) //gets all logs, newest first
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:date', async (req, res) => { // :date is a URL parameter
  try {
    const log = await DailyLog.findOne({ date: req.params.date })
    if (!log) return res.status(404).json({ error: 'No log found for this date' })
    res.json(log)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const log = await DailyLog.findByIdAndUpdate(req.params.id, req.body, { new: true }) // updates a document by mongodb _id
    res.json(log)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => { //deletes by id
  try {
    await DailyLog.findByIdAndDelete(req.params.id)
    res.json({ message: 'Log deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router