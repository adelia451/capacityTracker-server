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
  timeSpent: { type: Number, default: 0 },       // pulled from GCal duration on sync
  timesPostponed: { type: Number, default: 0 },
  postponedDates: [{ type: String }],

  startTime: { type: String, default: null },
  endTime:   { type: String, default: null },

  // Class-specific fields
  skippedClass:     { type: Boolean, default: false },
  skipClassReasons: { type: [String], enum: ['sick', 'workload', 'period pain', 'low mood', 'tiredness'], default: [] },

  // Google Calendar fields
  gcalEventId: { type: String, default: null },  // duplicate prevention on sync
  source: { type: String, enum: ['manual', 'gcal'], default: 'gcal' }
})

module.exports = mongoose.model('Task', taskSchema)