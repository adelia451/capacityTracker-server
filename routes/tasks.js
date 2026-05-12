const router = require('express').Router()
const Task = require('../models/Task')

router.post('/', async (req, res) => {
  try {
    const task = new Task(req.body)
    await task.save()
    res.status(201).json(task)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ date: -1 })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:date', async (req, res) => {
  try {
    const tasks = await Task.find({ date: req.params.date }).sort({ startTime: 1 })
    res.json(tasks)  // 200 with empty array when no tasks exist for this date
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    // Separate array-mutation fields from regular scalar fields
    const { postponedDate, removePostponedDate, ...fields } = req.body
    const mongoUpdate = {}

    if (Object.keys(fields).length) {
      mongoUpdate.$set = { ...fields }
    }

    // $addToSet prevents duplicate dates in the postponedDates array
    if (postponedDate) {
      mongoUpdate.$addToSet = { postponedDates: postponedDate }
    } else if (removePostponedDate) {
      mongoUpdate.$pull = { postponedDates: removePostponedDate }
    }

    // Only reset timeSpent when timesPostponed is actually increasing
    if (fields.timesPostponed !== undefined) {
      const existing = await Task.findById(req.params.id)
      if (existing && fields.timesPostponed > existing.timesPostponed) {
        mongoUpdate.$set = { ...(mongoUpdate.$set || {}), timeSpent: 0 }
      }
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      mongoUpdate,
      { returnDocument: 'after', runValidators: true }
    )
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json({ message: 'Task deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
