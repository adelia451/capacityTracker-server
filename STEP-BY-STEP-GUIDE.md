## Step 1: Back-End API
**Goals**
- Build and test all planned Express routes:
    - All Mongoose models defined and connected to MongoDB Atlas
    - All API routes returning correct responses when tested in Thunder Client

---
### 1.1: Project Setup

- Create your two repos:
    - `capacity-tracker` (frontend, leave empty for now)
    - `capacity-tracker-server` (backend)
<br>
- In `capacity-tracker-server`:
  - `npm init -y` creates your `package.json` that records the project name, version, and what packages the project depends on. Without this file, Node doesn't know anything about the project.
  - `npm install express mongoose dotenv cors` downloads these four packages into `node_modules` folder and records them as dependencies in package.json
```
npm init -y
npm install express mongoose dotenv cors
```
<br>

- These packages each serve a role:
    - express → handles routes and server logic
    - mongoose → lets us define structured data and talk to MongoDB
    - dotenv → lets us hide sensitive data like API keys
    - cors → allows frontend and backend to communicate across ports
<br>

- File structure to create:
```
capacity-tracker-server/
├── server.js
├── .env
├── .gitignore
├── /models
├── /routes
└── /services
```

- `.gitignore` must contain: `node_modules` and `.env`. 
  - `.env` will contain sensitive credentials (like your database connection string), so it should never be pushed to GitHub.
  - `node_modules` will contain installed packages and can be very large, so it is excluded to keep the repository clean and lightweight.

---
### 1.2: Server Setup & Database Connection
- Create your MongoDB Atlas cluster, get your connection string, and copy it to paste into `.env`. 
- `.env` must contain:

```
MONGO_URI=your_atlas_connection_string
PORT=3000
```
<br>

- In `server.js`:
```js
const express = require('express')  // Import Express
const mongoose = require('mongoose')    // Import Mongoose
const cors = require('cors')    // Import cors
require('dotenv').config()  // Load .env file

const app = express()   // Create the express application
app.use(cors())     // Allow requests from other origins
app.use(express.json()) // Allows server to read JSON data sent in requests

// CRUD Routes ----------
// Any request to /api/logs gets handled by routes/logs.js
app.use('/api/logs', require('./routes/logs'))
// Any request to /api/tasks gets handled by routes/tasks.js
app.use('/api/tasks', require('./routes/tasks'))

// Analysis Routes ----------
// /api/capacity, /api/insights, /api/prediction all handled by routes/analysis.js
app.use('/api', require('./routes/analysis'))

// Connect to MongoDB Atlas using the connection string from .env
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected')) // Success
  .catch(err => console.log(err))   // Error

// Start the server and listen for incoming requests on the port defined in .env
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`) 
})
```
Each `app.use()` line connects a route file to a base URL:
- `/api/logs` → handled in `routes/logs.js`
- `/api/tasks` → handled in `routes/tasks.js`
- `/api` → handled in `routes/analysis.js`

This keeps code modular instead of putting everything in one file.

---
### 1.3: Data Modeling with Mongoose

Create two files in `/models`:
- `models/DailyLog.js`

```js
const mongoose = require('mongoose')

const dailyLogSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },

  sleep: {
    start: String,
    end: String,
    hours: Number,
    state: { 
      type: String, 
      enum: ['sleepy', 'tired', 'neutral', 'awake', 'energized'] 
    }
  },

  moodLogs: [{ 
    time: String, 
    value: { 
      type: String, 
      enum: ['depressed', 'heavy', 'sad', 'meh', 'neutral', 'positive', 'happy'] 
    } 
  }],

  stressLogs: [{ 
    time: String, 
    value: { 
      type: String, 
      enum: ['understimulated', 'stress-free', 'balanced', 'debilitating', 'paralyzing'] 
    } 
  }],

  medication: {
    takenAt: String,
    feltOnset: String,
    feltPeak: String,
    feltEnd: String,
    focusCapacityHours: Number,
    feltQuality: Number,
    skipped: Boolean,
    skipReasons: [{ 
      type: String, 
      enum: ['low energy', 'emotional state', 'light workload', 'intentional rest', 'outing'] 
    }]
  },

  proteinLogs: [{ time: String, grams: Number }],

  naps: [{
    start: String,
    end: String,
    hours: Number,
    feltRestedAfter: { 
      type: String, 
      enum: ['sleepy', 'tired', 'neutral', 'awake', 'energized'] 
    }
  }],

  alcohol: Boolean
})

module.exports = mongoose.model('DailyLog', dailyLogSchema)
```

- `models/Task.js`

```js
const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: String,
  date: { type: String, required: true },
  effortWeight: { type: Number, min: 1, max: 5 },
  completed: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 },       // pulled from GCal duration on sync
  timesPostponed: { type: Number, default: 0 },
  postponedDates: [{ type: String }],

  // Google Calendar fields
  gcalEventId: { type: String, default: null },  // duplicate prevention on sync
  source: { type: String, enum: ['manual', 'gcal'], default: 'gcal' }
})

module.exports = mongoose.model('Task', taskSchema)
```

- Go through this schema and adjust it to match your tracking needs.
- For example:
    - remove fields you don’t care about
    - add new ones (e.g., exercise, caffeine)
    - change enums if your categories differ