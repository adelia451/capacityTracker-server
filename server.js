const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

// CRUD Routes
app.use('/api/logs', require('./routes/logs'))
app.use('/api/tasks', require('./routes/tasks'))
// Analysis Routes
app.use('/api', require('./routes/analysis'))

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err))

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})

// gcal step
// app.use('/api/gcal', require('./routes/gcal'))
// The OAuth client setup — but that'll probably live in its own googleAuth.js file that gets imported where needed, not directly in server.js

