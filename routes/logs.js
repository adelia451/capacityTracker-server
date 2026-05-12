const router = require('express').Router()
const DailyLog = require('../models/DailyLog')

router.post('/', async (req, res) => {
  try {
    const log = new DailyLog(req.body)
    await log.save()
    res.status(201).json(log)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A log already exists for this date' })
    }
    res.status(400).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const logs = await DailyLog.find().sort({ date: -1 })
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:date', async (req, res) => {
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
    const log = await DailyLog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    )
    if (!log) return res.status(404).json({ error: 'Log not found' })
    res.json(log)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const log = await DailyLog.findByIdAndDelete(req.params.id)
    if (!log) return res.status(404).json({ error: 'Log not found' })
    res.json({ message: 'Log deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Generic handler for pulling a single subdocument entry by _id
const pullSubdoc = (arrayField) => async (req, res) => {
  try {
    const log = await DailyLog.findByIdAndUpdate(
      req.params.id,
      { $pull: { [arrayField]: { _id: req.params.entryId } } },
      { returnDocument: 'after' }
    )
    if (!log) return res.status(404).json({ error: 'Log not found' })
    res.json(log)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

router.delete('/:id/mood/:entryId',   pullSubdoc('moodLogs'))
router.delete('/:id/stress/:entryId', pullSubdoc('stressLogs'))
router.delete('/:id/nap/:entryId',    pullSubdoc('naps'))

module.exports = router
