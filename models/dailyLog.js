const mongoose = require('mongoose')

const dailyLogSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // format: YYYY-MM-DD (local time)

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