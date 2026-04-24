const router = require('express').Router()
const Task = require('../models/task')

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
    const tasks = await Task.find({ date: req.params.date })
    if (!tasks.length) return res.status(404).json({ error: 'No tasks found for this date' })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
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