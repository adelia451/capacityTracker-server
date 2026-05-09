const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../capacityTracker/frontend/dist')))

// CRUD Routes
app.use('/api/logs', require('./routes/logs'))
app.use('/api/tasks', require('./routes/tasks'))
// Analysis Routes
app.use('/api', require('./routes/analysis'))
// Google Calendar Sync
app.use('/api/gcal', require('./routes/gcal'))

// Catch-all: serve frontend for any non-API route (must be after all API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../capacityTracker/frontend/dist/index.html'))
})

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err))

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})

