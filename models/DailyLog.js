const mongoose = require('mongoose')

const state = ['sleepy', 'tired', 'neutral', 'awake', 'energized']
const reason = [
  // neutral / fallback
  'no clear reason',

  // internal
  'accomplishment',
  'loneliness',
  'low motivation',
  'mentally tired',
  'overthinking',
  'overwhelmed',
  'self image',
      
  // physical
  'hunger',
  'low energy',
  'sickness',

  //external
  'career',
  'conflict',
  'family',
  'hobby',
  'relationship',
  'relaxation',
  'school',
  'social activity',
  'social life',
  'workload'
]

const dailyLogSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // format: YYYY-MM-DD (local time)

  sleep: {
    start: String,
    end: String,
    hours: Number,
    state: { 
      type: String, 
      enum: state 
    }
  },

  naps: [{
    start: String,
    end: String,
    hours: Number,
    feltRestedAfter: { 
      type: String, 
      enum: state
    }
  }],

  moodLogs: [{
    time: String,
    value: {
      type: String,
      enum: ['depressed', 'heavy', 'sad', 'meh', 'neutral', 'positive', 'happy']
    },
    reason: [{ type: String, enum: reason }]
  }],

  stressLogs: [{
    time: String,
    value: {
      type: String,
      enum: ['understimulated', 'stress-free', 'balanced', 'debilitating', 'paralyzing']
    },
    reason: [{ type: String, enum: reason }]
  }],

  medication: {
    takenAt: String,
    feltOnset: String,
    feltPeak: String,
    feltEnd: String,
    focusCapacityHours: Number,
    medQuality: {
      type: String,
      enum: ['no effect', 'lightly felt', 'felt', 'strongly felt']
    },
    focusQuality: {
      type: String,
      enum: ['unfocused', 'focused', 'locked-in']
    },
    skipped: Boolean,
    skipReasons: [{ 
      type: String, 
      enum: ['low energy', 'emotional state', 'light workload', 'intentional rest', 'outing'] 
    }]
  },

  proteinLogs: [{ time: String, grams: Number }],

  alcohol: { type: Number, default: 0 },

  actualCapacityRating: { type: Number, min: 1, max: 10, default: null }
})

module.exports = mongoose.model('DailyLog', dailyLogSchema)