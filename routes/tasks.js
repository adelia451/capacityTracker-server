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
    // find not findOne — multiple tasks can exist for the same date
    const tasks = await Task.find({ date: req.params.date }).sort({ startTime: 1 })
    if (!tasks.length) return res.status(404).json({ error: 'No tasks found for this date' })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const update = { ...req.body }
    if (update.timesPostponed !== undefined) update.timeSpent = 0
    const task = await Task.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' })
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id)
    res.json({ message: 'Task deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router