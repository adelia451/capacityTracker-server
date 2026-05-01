# Step 1: Back-End API

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
  - `npm install express mongoose dotenv cors` downloads these four packages into `node_modules` and records them as dependencies in `package.json`

```
npm init -y
npm install express mongoose dotenv cors
```
<br>

- These packages each serve a role:
    - **express** → handles routes and server logic
    - **mongoose** → lets us define structured data and talk to MongoDB
    - **dotenv** → lets us hide sensitive data like API keys
    - **cors** → allows frontend and backend to communicate across ports
<br>

- File structure to create:
```
capacity-tracker-server/
├── server.js
├── .env
├── .gitignore
├── /models
├── /routes
├── /services
└── /scripts
```

- `.gitignore` must contain: `node_modules` and `.env`
  - `.env` will contain sensitive credentials (like your database connection string), so it should never be pushed to GitHub.
  - `node_modules` will contain installed packages and can be very large, so it is excluded to keep the repository clean and lightweight.

---

### 1.2: Server Setup & Database Connection

**Setting up MongoDB Atlas:**
- Create a MongoDB Atlas account and create a free cluster
- Go to **Database Access** and create a database user — save the password somewhere, you'll need it
- Go to **Network Access** and add your IP address (or `0.0.0.0/0` to allow all IPs during development)

**Getting your connection string:**
- In your cluster, click **Connect**
- Click **Drivers** and set to to **Node.js** 
- There you will get your connection string

**`.env` must contain:**
```
MONGO_URI=your_atlas_connection_string
PORT=3000
```
<br>

**In `server.js`:**
```js
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
// Google Calendar Sync
app.use('/api/gcal', require('./routes/gcal'))

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err))

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})
```

Each `app.use()` line connects a route file to a base URL path. This keeps the code modular. Instead of one giant file, each section of the API lives in its own file.

---

### 1.3: Data Modeling with Mongoose

Create two files in `/models`:

**`models/DailyLog.js`**

This tracks everything about a single day: sleep, mood, stress, medication, and more. Each day gets one log, which is why `date` is `unique: true`.

`state` and `reason` are pulled out as constants at the top and reused across multiple fields so there is only one place to update them.

```js
const mongoose = require('mongoose')

const state = ['sleepy', 'tired', 'neutral', 'awake', 'energized']
const reason = [
  // neutral / fallback
  'no clear reason',
  // internal
  'accomplishment', 'loneliness', 'low motivation', 'mentally tired',
  'overthinking', 'overwhelmed', 'self image',
  // physical
  'hunger', 'low energy', 'sickness',
  // external
  'career', 'conflict', 'family', 'hobby', 'relationship',
  'relaxation', 'school', 'social activity', 'social life', 'workload'
]

const dailyLogSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // format: YYYY-MM-DD (local time)

  sleep: {
    start: String,
    end: String,
    hours: Number,
    state: { type: String, enum: state }
  },

  naps: [{
    start: String,
    end: String,
    hours: Number,
    feltRestedAfter: { type: String, enum: state }
  }],

  moodLogs: [{ 
    time: String, 
    value: { 
      type: String, 
      enum: ['depressed', 'heavy', 'sad', 'meh', 'neutral', 'positive', 'happy'] 
    },
    reason: { type: String, enum: reason, default: 'no clear reason' }
  }],

  stressLogs: [{ 
    time: String, 
    value: { 
      type: String, 
      enum: ['understimulated', 'stress-free', 'balanced', 'debilitating', 'paralyzing'] 
    },
    reason: { type: String, enum: reason, default: 'no clear reason' }
  }],

  medication: {
    takenAt: String,
    feltOnset: String,
    feltPeak: String,
    feltEnd: String,
    focusCapacityHours: Number,
    medQuality: [{ type: String, enum: ['no effect', 'lightly felt', 'felt', 'strongly felt'] }],
    focusQuality: [{ type: String, enum: ['unfocused', 'focused', 'locked-in'] }],
    skipped: Boolean,
    skipReasons: [{ 
      type: String, 
      enum: ['low energy', 'emotional state', 'light workload', 'intentional rest', 'outing'] 
    }]
  },

  proteinLogs: [{ time: String, grams: Number }],

  alcohol: Boolean
})

module.exports = mongoose.model('DailyLog', dailyLogSchema)
```

> **Customizing this for yourself:**
> - `moodLogs` and `stressLogs` are arrays because you might log mood/stress multiple times in a day. Each entry has a `time`, a `value`, and a `reason`
> - The `reason` enum covers internal, physical, and external reasons. Update it to match what actually applies to your life
> - `medQuality` tracks how strongly the medication was felt. `focusQuality` tracks focus level. Both are arrays so you can log how they felt at different points in the day (e.g. onset vs peak vs wearing off)
> - `proteinLogs`, `naps`, and `alcohol` are in the schema now even though I am not analyzing them yet. They're something I want to implement at the end of the project since it may take extra time and this is an assignment with a due date. I can start logging that data and it will be ready when I build analysis for it later.

---

**`models/Task.js`**

Tasks sync in from Google Calendar. The schema is built around that. Most fields get populated automatically on sync.

```js
const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['class', 'homework', 'practice', 'projects', 'admin', 'maintenance', 'social']
  },
  date: { type: String, required: true },
  effortWeight: { type: Number, min: 1, max: 5 },
  completed: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 },
  timesPostponed: { type: Number, default: 0 },
  postponedDates: [{ type: String }],

  // Google Calendar fields
  gcalEventId: { type: String, default: null },
  source: { type: String, enum: ['manual', 'gcal'], default: 'gcal' }
})

module.exports = mongoose.model('Task', taskSchema)
```

> **Customizing this for yourself:**
> - The `category` enum should match your Google Calendar names exactly (lowercase). If you rename a calendar, update this too.
> - `effortWeight` is a 1–5 scale you set manually to reflect how mentally demanding a task is. This will eventually feed into capacity calculations
> - `timeSpent` is populated automatically from the event duration when syncing from GCal
> - `gcalEventId` prevents duplicate tasks from being created if you sync multiple times

---

### 1.4: Building the Routes

Routes are what define your API endpoints -- what URLs exist and what they do. Each route file handles one "resource" (logs, tasks, etc.).

**The pattern for every route file:**
- `POST /` → create something new
- `GET /` → get everything
- `GET /:date` → get by date
- `PUT /:id` → update one thing by its MongoDB ID
- `DELETE /:id` → delete one thing by its MongoDB ID

**`routes/logs.js`**
```js
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
    const log = await DailyLog.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!log) return res.status(404).json({ error: 'Log not found' })
    res.json(log)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await DailyLog.findByIdAndDelete(req.params.id)
    res.json({ message: 'Log deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
```

**`routes/tasks.js`** follows the exact same pattern, just swap `DailyLog` for `Task`. The only difference is the GET by date uses `.find()` instead of `.findOne()` because multiple tasks can exist for the same date. The PUT route also includes the same null check.

> **Why `{ new: true }` in the PUT route?** By default, `findByIdAndUpdate` returns the document *before* the update. Passing `{ new: true }` makes it return the updated version instead, which is what you actually want to see in the response.
>
> **Why check `err.code === 11000` in the POST route?** MongoDB throws that specific error code when a unique constraint is violated. Catching it separately lets you return a clear, readable message instead of a raw database error.

---

### 1.5: Analysis Routes

Analysis routes don't do CRUD. They read existing data and compute something from it. They live in `routes/analysis.js` and each one calls a service to do the actual calculation.

```js
const router = require('express').Router()
const capacityService = require('../services/capacityService')
const insightService = require('../services/insightService')
const predictionService = require('../services/predictionService')

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

module.exports = router
```

> `/capacity` defaults to today if no `?date=` is passed in the URL. You can also call it like `/api/capacity?date=2026-04-20` to get a score for a past day.

---

### 1.6: The Capacity Scoring System

This is the core of the whole app. `services/capacityService.js` takes a day's log and turns it into a single number representing your capacity that day.

**How scoring works:**

Each factor (sleep hours, sleep state, mood, stress, medication quality) gets normalized to a roughly -1 to +1 range, then multiplied by its weight and added to a running total. The final score is a sum of all factors.

```js
const moodMap = {
  depressed: -4, heavy: -3, sad: -2, meh: -1,
  neutral: 0, positive: 1, happy: 2
}

const stressMap = {
  understimulated: -1, 'stress-free': 1, balanced: 2,
  debilitating: -2, paralyzing: -3
}

const sleepMap = {
  sleepy: -2, tired: -1, neutral: 0, awake: 1, energized: 2
}

const medQualityMap = {
  'no effect': -2, 'lightly felt': -1, 'felt': 1, 'strongly felt': 2
}

const focusQualityMap = {
  'unfocused': -1, 'focused': 1, 'locked-in': 2
}
```

**The stress scale is a U-shape** -- `balanced` is the peak because that's productive good stress. Both extremes hurt:
- `paralyzing` (-3) -- so much stress you do nothing
- `debilitating` (-2) -- lots of stress, some output but taxing
- `stress-free` (+1) -- feeling good with little to no work to worry about
- `understimulated` (-1) -- so little urgency you end up doing nothing

**!! This stress scale, and all scales, are personal to my experience !!**

**Normalization constants** make sure each factor contributes on the same scale:
```js
const MAX_MOOD = 4
const MAX_STRESS = 3
const MAX_SLEEP_STATE = 2
const BASELINE_SLEEP = 6
const MAX_SLEEP_DEVIATION = 6
const MAX_MED_QUALITY = 2
const MAX_FOCUS_QUALITY = 2
```

**Weights** control how much each factor counts. Right now they're all equal — this is intentional. Eventually these will be learned from your data:
```js
const weights = {
  sleepHours: 1,
  sleepState: 1,
  mood: 1,
  stress: 1,
  medication: 1
  //protein    ← coming later
  //napHours   ← coming later
  //napState   ← coming later
  //alcohol    ← coming later
}
```

> **Customizing this for yourself:**
> - Change the values in `moodMap` and `stressMap` to reflect how *you* experience each state. The numbers should feel right for your life, not someone else's
> - If a factor matters more to you than others (e.g. sleep is everything), increase its weight
> - If you don't take medication, remove the medication block from the score calculation
> - The normalization constants should match your maps. If you change `stressMap` values, update `MAX_STRESS` to match the highest absolute value in the map

---

### 1.7: Google Calendar Integration

Tasks come from Google Calendar instead of being created manually. This way you don't have to maintain two systems — everything you schedule in GCal automatically shows up in the app.

**Setup (one time only):**

**Step 1 — Install the package:**
```
npm install googleapis
```

**Step 2 — Create a Google Cloud project:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Go to **APIs & Services → Library**, search **Google Calendar API**, enable it
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. Application type: **Desktop app**
6. Copy your **Client ID** and **Client Secret**

**Step 3 — Add credentials to `.env`:**
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=           ← fill in after step 4

GCAL_CLASS_ID=
GCAL_HOMEWORK_ID=
GCAL_PRACTICE_ID=
GCAL_PROJECTS_ID=
GCAL_ADMIN_ID=
GCAL_MAINTENANCE_ID=
GCAL_SOCIAL_ID=
```

For calendar IDs: open each calendar in Google Calendar → Settings → scroll to **Calendar ID**. Your main calendar's ID is your Gmail address.

**Step 4 — Get your refresh token (run once, never again):**
```
node scripts/getGoogleToken.js
```
Open the URL it prints, click Allow, paste the code back in. Copy the refresh token it gives you into `.env`.

**Step 5 — Sync:**

Call `POST /api/gcal/sync` whenever you want to pull in new events. It fetches everything from yesterday through 2 weeks ahead and creates tasks in your database automatically. Events already synced won't be duplicated.

> **Customizing this for yourself:**
> - The 7 calendar categories (`class`, `homework`, `practice`, `projects`, `admin`, `maintenance`, `social`) should match the names of your actual Google Calendar. Create a separate calendar for each one in Google Calendar
> - If you want to change the sync window (currently yesterday → 2 weeks ahead), edit `timeMin` and `timeMax` in `routes/gcal.js`
> - If you add a new category later, add it to both the `CALENDARS` object in `routes/gcal.js` and the `enum` in `models/task.js`

---

### 1.8: Testing with Thunder Client

Thunder Client is a VS Code extension for testing API routes without needing a frontend. Install it from the Extensions tab (search "Thunder Client").

**Before testing:** run `node server.js` and confirm you see both:
```
MongoDB connected
Server running on port 3000
```

**Log routes:**

| # | Method | URL | Body |
|---|--------|-----|------|
| 1 | POST | `/api/logs` | See below |
| 2 | GET | `/api/logs` | none |
| 3 | GET | `/api/logs/2026-04-24` | none |
| 4 | PUT | `/api/logs/:id` | `{ "sleep": { "hours": 9 } }` |
| 5 | DELETE | `/api/logs/:id` | none |

POST body for creating a log:
```json
{
  "date": "2026-04-24",
  "sleep": { "start": "23:00", "end": "07:00", "hours": 8, "state": "awake" },
  "moodLogs": [{ "time": "09:00", "value": "positive" }],
  "stressLogs": [{ "time": "10:00", "value": "balanced" }],
  "medication": { "takenAt": "08:30", "medQuality": ["felt"], "focusQuality": ["focused"], "skipped": false }
}
```

**Task routes**: same pattern as logs, use this body for POST:
```json
{
  "title": "Finish week 13 homework",
  "category": "homework",
  "date": "2026-04-24",
  "effortWeight": 3
}
```

> In real use, tasks come from Google Calendar sync — you'd call `POST /api/gcal/sync` instead of creating tasks manually. Manual creation is just for testing.

**Analysis routes**: re-create a log first, then test

| # | Method | URL |
|---|--------|-----|
| 11 | GET | `/api/capacity` |
| 12 | GET | `/api/insights` |
| 13 | GET | `/api/prediction` |

Insights and prediction will return `"Not enough data yet"` until you have 7+ days of logs. That's expected and correct behavior.

---

### Future: When to Upgrade the Analysis

The current prediction and scoring is intentionally simple -- averages and hardcoded weights. Here's when and what to change as you collect more data.

**Around 30 days of logs -- expand the prediction window**

Right now predictions use the last 7 days. At 30+ days you have enough history that a wider window will be more accurate. In `predictionService.js`, change `.limit(7)` to `.limit(30)` and update the minimum data check from `logs.length < 7` to `logs.length < 30`.

**Around 60-90 days -- start looking for patterns**

This is when you have enough data to start detecting real correlations. Things to build:
- Burnout streak detection (4+ consecutive high-score days predicting a drop)
- Social event carryover (does the day after a social task consistently score lower?)
- Emotional carryover (does low end-of-day mood predict lower next-day capacity?)

These live in `insightService.js` and use `reasonMap.js` for mood/stress reason analysis.

**Around 3-6 months -- replace hardcoded weights with learned ones**

The `weights` object in `capacityService.js` currently treats every factor equally. Once you have enough data, you can train a simple regression model to learn which factors actually matter most for YOUR capacity. The model output replaces the hardcoded `1` values. Until then, equal weights are a reasonable starting point.

**Signs you have enough data to start ML:**
- You can see real patterns in your logs (some days are consistently better than others)
- Insights are returning actual observations, not just sleep averages
- You have at least a few instances of burnout cycles, social events, medication skips, etc. to learn from

You do not need to do all of this at once. Each upgrade is independent -- you can add burnout detection without touching the weights, or expand the window without rebuilding insights.
