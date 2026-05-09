const reasonMap = require('../utils/reasonMap')

const SLEEP_MAP  = { sleepy: -2, tired: -1, neutral: 0, awake: 1, energized: 2 }
const MOOD_MAP   = { depressed: -4, heavy: -3, sad: -2, meh: -1, neutral: 0, positive: 1, happy: 2 }
const STRESS_MAP = { understimulated: -1, 'stress-free': 1, balanced: 2, debilitating: -2, paralyzing: -3 }
const MED_MAP    = { 'no effect': -2, 'lightly felt': -1, 'felt': 1, 'strongly felt': 2 }
const FOCUS_MAP  = { 'unfocused': -1, 'focused': 1, 'locked-in': 2 }

const LABELS = {
  // Sleep
  sleepHours:           'sleep duration',
  sleepStateNum:        'how rested you feel on waking',
  sleepStartHour:       'time you went to sleep',
  sleepEndHour:         'time you woke up',
  // Mood
  avgMoodNum:           'overall mood',
  moodReasonInternal:   'internal mood triggers',
  moodReasonExternal:   'external mood triggers',
  moodReasonPhysical:   'physical mood triggers',
  // Stress
  avgStressNum:         'stress level',
  stressReasonInternal: 'internal stress triggers',
  stressReasonExternal: 'external stress triggers',
  stressReasonPhysical: 'physical stress triggers',
  // Naps
  napHours:             'nap duration',
  napStateNum:          'how rested after naps',
  // Medication
  medicationTaken:      'taking medication',
  medQualityNum:        'medication quality',
  focusQualityNum:      'focus quality',
  focusCapacityHours:   'medication focus hours',
  // Other log fields
  alcohol:              'alcohol',
  actualCapacityRating: 'self-rated capacity',
  capacityScore:        'computed capacity score',
  // Tasks — totals
  totalEffortWeight:    'planned cognitive load (effort)',
  totalTimeSpent:       'total time worked (mins)',
  taskCount:            'number of tasks',
  completionRate:       'task completion rate',
  postponedCount:       'tasks postponed',
  skippedClassCount:    'classes skipped',
  // Tasks — time by category
  classTime:            'time in class',
  homeworkTime:         'time on homework',
  practiceTime:         'time practicing violin',
  projectsTime:         'time on personal projects',
  adminTime:            'time on admin tasks',
  maintenanceTime:      'time on maintenance/chores',
  socialTime:           'time on social activities',
  // Tasks — effort by category
  classEffort:          'class effort weight',
  homeworkEffort:       'homework effort weight',
  practiceEffort:       'practice effort weight',
  projectsEffort:       'projects effort weight',
  adminEffort:          'admin effort weight',
  maintenanceEffort:    'maintenance effort weight',
  socialEffort:         'social effort weight',
  // Rolling — time (previous N days, not today)
  prevTimeSpent2day:    'total time worked over previous 2 days',
  prevTimeSpent3day:    'total time worked over previous 3 days',
  prevTimeSpent4day:    'total time worked over previous 4 days',
  // Rolling — sleep (previous N nights)
  prevSleep2dayAvg:     'average sleep over previous 2 nights',
  prevSleep3dayAvg:     'average sleep over previous 3 nights',
  // Rolling — mood (previous N days)
  prevMood2dayAvg:      'average mood over previous 2 days',
}

const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

const parseHour = (timeStr) => {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  return isNaN(h) ? null : h + (m || 0) / 60
}

const reasonCategories = (entries) => {
  const cats = (entries || []).flatMap(e => (e.reason || []).map(r => reasonMap[r] || 'neutral'))
  return {
    internal: cats.filter(c => c === 'internal').length || null,
    external: cats.filter(c => c === 'external').length || null,
    physical: cats.filter(c => c === 'physical').length || null,
  }
}

const rollingTaskTime = (logs, tasksByDate, currentIndex, nDays) => {
  if (currentIndex < nDays) return null
  let total = 0
  for (let d = 1; d <= nDays; d++) {
    const prevTasks = tasksByDate[logs[currentIndex - d]?.date] || []
    total += prevTasks.reduce((s, t) => s + (t.timeSpent || 0), 0)
  }
  return total > 0 ? total : null
}

const rollingSleepAvg = (logs, currentIndex, nDays) => {
  if (currentIndex < nDays) return null
  const vals = []
  for (let d = 1; d <= nDays; d++) {
    const h = logs[currentIndex - d]?.sleep?.hours
    if (h != null) vals.push(h)
  }
  return vals.length ? avg(vals) : null
}

const rollingMoodAvg = (logs, currentIndex, nDays) => {
  if (currentIndex < nDays) return null
  const vals = []
  for (let d = 1; d <= nDays; d++) {
    const entries = logs[currentIndex - d]?.moodLogs || []
    const allVals = entries.flatMap(e => e.value || [])
    if (allVals.length) vals.push(avg(allVals.map(v => MOOD_MAP[v] ?? 0)))
  }
  return vals.length ? avg(vals) : null
}

const buildVectors = (logs, scoreMap, tasksByDate) => {
  return logs.map((log, i) => {
    const tasks = tasksByDate[log.date] || []

    // Mood
    const allMoodVals  = log.moodLogs?.map(e => e.value).filter(Boolean) || []
    const avgMoodNum   = allMoodVals.length ? avg(allMoodVals.map(v => MOOD_MAP[v] ?? 0)) : null
    const moodReasons  = reasonCategories(log.moodLogs)

    // Stress
    const allStressVals = log.stressLogs?.map(e => e.value).filter(Boolean) || []
    const avgStressNum  = allStressVals.length ? avg(allStressVals.map(v => STRESS_MAP[v] ?? 0)) : null
    const stressReasons = reasonCategories(log.stressLogs)

    // Naps
    const napHours   = log.naps?.length ? log.naps.reduce((s, n) => s + (n.hours || 0), 0) : null
    const napStates  = log.naps?.map(n => SLEEP_MAP[n.feltRestedAfter] ?? null).filter(v => v != null) || []
    const napStateNum = napStates.length ? avg(napStates) : null

    // Medication
    const medicationTaken  = log.medication != null ? (log.medication.skipped ? 0 : 1) : null
    const medQVals         = log.medication?.medQuality?.map(q => MED_MAP[q] ?? null).filter(v => v != null) || []
    const medQualityNum    = medQVals.length ? avg(medQVals) : null
    const focQVals         = log.medication?.focusQuality?.map(q => FOCUS_MAP[q] ?? null).filter(v => v != null) || []
    const focusQualityNum  = focQVals.length ? avg(focQVals) : null
    const focusCapacityHrs = log.medication?.focusCapacityHours ?? null

    // Tasks — totals
    const totalEffortWeight = tasks.length ? tasks.reduce((s, t) => s + (t.effortWeight || 0), 0) : null
    const totalTimeSpent    = tasks.length ? tasks.reduce((s, t) => s + (t.timeSpent    || 0), 0) : null
    const taskCount         = tasks.length || null
    const completedCount    = tasks.filter(t => t.completed).length
    const completionRate    = tasks.length ? completedCount / tasks.length : null
    const postponedCount    = tasks.reduce((s, t) => s + (t.timesPostponed || 0), 0) || null
    const skippedClassCount = tasks.filter(t => t.skippedClass).length || null

    const timeFor   = (cat) => { const t = tasks.filter(t => t.category === cat).reduce((s, t) => s + (t.timeSpent    || 0), 0); return t > 0 ? t : null }
    const effortFor = (cat) => { const e = tasks.filter(t => t.category === cat).reduce((s, t) => s + (t.effortWeight || 0), 0); return e > 0 ? e : null }

    return {
      date: log.date,
      // Sleep
      sleepHours:      log.sleep?.hours ?? null,
      sleepStateNum:   log.sleep?.state ? (SLEEP_MAP[log.sleep.state] ?? null) : null,
      sleepStartHour:  parseHour(log.sleep?.start),
      sleepEndHour:    parseHour(log.sleep?.end),
      // Mood
      avgMoodNum,
      moodReasonInternal: moodReasons.internal,
      moodReasonExternal: moodReasons.external,
      moodReasonPhysical: moodReasons.physical,
      // Stress
      avgStressNum,
      stressReasonInternal: stressReasons.internal,
      stressReasonExternal: stressReasons.external,
      stressReasonPhysical: stressReasons.physical,
      // Naps
      napHours,
      napStateNum,
      // Medication
      medicationTaken,
      medQualityNum,
      focusQualityNum,
      focusCapacityHours: focusCapacityHrs,
      // Other
      alcohol:              log.alcohol ?? null,
      actualCapacityRating: log.actualCapacityRating ?? null,
      capacityScore:        scoreMap[log.date] ?? null,
      // Tasks — totals
      totalEffortWeight,
      totalTimeSpent,
      taskCount,
      completionRate,
      postponedCount,
      skippedClassCount,
      // Tasks — time by category
      classTime:       timeFor('class'),
      homeworkTime:    timeFor('homework'),
      practiceTime:    timeFor('practice'),
      projectsTime:    timeFor('projects'),
      adminTime:       timeFor('admin'),
      maintenanceTime: timeFor('maintenance'),
      socialTime:      timeFor('social'),
      // Tasks — effort by category
      classEffort:       effortFor('class'),
      homeworkEffort:    effortFor('homework'),
      practiceEffort:    effortFor('practice'),
      projectsEffort:    effortFor('projects'),
      adminEffort:       effortFor('admin'),
      maintenanceEffort: effortFor('maintenance'),
      socialEffort:      effortFor('social'),
      // Rolling — time (previous N days, not today)
      prevTimeSpent2day: rollingTaskTime(logs, tasksByDate, i, 2),
      prevTimeSpent3day: rollingTaskTime(logs, tasksByDate, i, 3),
      prevTimeSpent4day: rollingTaskTime(logs, tasksByDate, i, 4),
      // Rolling — sleep (previous N nights)
      prevSleep2dayAvg: rollingSleepAvg(logs, i, 2),
      prevSleep3dayAvg: rollingSleepAvg(logs, i, 3),
      // Rolling — mood (previous N days)
      prevMood2dayAvg: rollingMoodAvg(logs, i, 2),
    }
  })
}

const pearson = (xs, ys) => {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => x != null && y != null)
  const n = pairs.length
  if (n < 7) return { r: null, n }
  const mx = avg(pairs.map(([x]) => x))
  const my = avg(pairs.map(([, y]) => y))
  const num = pairs.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0)
  const den = Math.sqrt(
    pairs.reduce((s, [x]) => s + (x - mx) ** 2, 0) *
    pairs.reduce((s, [, y]) => s + (y - my) ** 2, 0)
  )
  return { r: den === 0 ? 0 : num / den, n }
}

const formatInsight = ({ keyA, keyB, lag, r, n }) => {
  const labelA   = LABELS[keyA] || keyA
  const labelB   = LABELS[keyB] || keyB
  const strength = Math.abs(r) >= 0.7 ? 'strongly' : 'moderately'
  const dir      = r > 0 ? 'higher' : 'lower'

  if (lag === 0) {
    return `On days with ${r > 0 ? 'more/higher' : 'less/lower'} ${labelA}, your ${labelB} tends to be ${dir} (${strength} correlated, ${n} days of data).`
  }
  const lagStr = lag === 1 ? 'the next day' : 'two days later'
  return `Your ${labelA} ${strength} predicts ${dir} ${labelB} ${lagStr} (${n} days of data).`
}

const getCorrelationInsights = (logs, scoreMap, tasksByDate) => {
  if (logs.length < 10) return []

  const vectors = buildVectors(logs, scoreMap, tasksByDate)
  const keys    = Object.keys(vectors[0]).filter(k => k !== 'date')
  const seen    = new Set()
  const significant = []

  for (const keyA of keys) {
    for (const keyB of keys) {
      if (keyA === keyB) continue

      for (const lag of [0, 1, 2]) {
        const pairKey = lag === 0
          ? [keyA, keyB].sort().join('|') + '|0'
          : `${keyA}|${keyB}|${lag}`
        if (seen.has(pairKey)) continue
        seen.add(pairKey)

        const aVals = lag === 0 ? vectors.map(v => v[keyA]) : vectors.slice(0, -lag).map(v => v[keyA])
        const bVals = lag === 0 ? vectors.map(v => v[keyB]) : vectors.slice(lag).map(v => v[keyB])

        const { r, n } = pearson(aVals, bVals)
        if (r !== null && Math.abs(r) >= 0.45) {
          significant.push({ keyA, keyB, lag, r, n })
        }
      }
    }
  }

  return significant
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 10)
    .map(formatInsight)
}

module.exports = { getCorrelationInsights }
