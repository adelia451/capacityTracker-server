const mongoose = require('mongoose')

const weightSettingsSchema = new mongoose.Schema({
  sleepHours:     { type: Number, default: 1 },
  sleepState:     { type: Number, default: 1 },
  mood:           { type: Number, default: 1 },
  stress:         { type: Number, default: 1 },
  medication:     { type: Number, default: 1 },
  napState:       { type: Number, default: 1 },
  napHours:       { type: Number, default: 1 },
  prevDayTime:    { type: Number, default: 1 },
  prevDayAlcohol: { type: Number, default: 1 },
  lastCalibrated: { type: Date, default: null }
})

module.exports = mongoose.model('WeightSettings', weightSettingsSchema)
