const router = require('express').Router()
const { google } = require('googleapis')
const auth = require('../services/googleAuthService')
const Task = require('../models/Task')

const CALENDARS = {
  class:       process.env.GCAL_CLASS_ID,
  homework:    process.env.GCAL_HOMEWORK_ID,
  practice:    process.env.GCAL_PRACTICE_ID,
  projects:    process.env.GCAL_PROJECTS_ID,
  admin:       process.env.GCAL_ADMIN_ID,
  maintenance: process.env.GCAL_MAINTENANCE_ID,
  social:      process.env.GCAL_SOCIAL_ID,
}

// POST /api/gcal/sync
// Fetches events from all 7 calendars and upserts them as Tasks.
// Default window: yesterday through 2 weeks ahead.
router.post('/sync', async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth })

    const now = new Date()
    const timeMin = new Date(now)
    timeMin.setDate(timeMin.getDate() - 1)
    const timeMax = new Date(now)
    timeMax.setDate(timeMax.getDate() + 14)

    const results = { created: 0, updated: 0 }

    for (const [category, calendarId] of Object.entries(CALENDARS)) {
      if (!calendarId) continue

      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      })

      for (const event of (response.data.items || [])) {
        if (event.status === 'cancelled') continue

        const date = (event.start.date || event.start.dateTime || '').slice(0, 10)
        const timeSpent = getEventDurationMinutes(event)
        const existing = await Task.findOne({ gcalEventId: event.id })

        if (existing) {
          existing.title = event.summary || 'Untitled'
          existing.date = date
          existing.timeSpent = timeSpent
          await existing.save()
          results.updated++
        } else {
          await Task.create({
            title: event.summary || 'Untitled',
            category,
            date,
            timeSpent,
            gcalEventId: event.id,
            source: 'gcal'
          })
          results.created++
        }
      }
    }

    res.json({ message: 'Sync complete', ...results })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getEventDurationMinutes(event) {
  if (event.start.date) return 0  // all-day event, no meaningful duration
  const start = new Date(event.start.dateTime)
  const end = new Date(event.end.dateTime)
  return Math.round((end - start) / 60000)
}

module.exports = router
