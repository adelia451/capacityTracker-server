const { avg, pearson } = require('../utils/math')
const { SLEEP_MAP, MOOD_MAP, STRESS_MAP, MED_QUALITY_MAP: MED_MAP, FOCUS_QUALITY_MAP: FOCUS_MAP } = require('../utils/scoreMaps')
const reasonMap = require('../utils/reasonMap')

const LABELS = {
  sleepHours:           'sleep duration',
  sleepStateNum:        'how rested you feel on waking',
  sleepStartHour:       'bedtime',
  sleepEndHour:         'wake time',
  avgMoodNum:           'overall mood',
  moodReasonInternal:   'internal mood triggers',
  moodReasonExternal:   'external mood triggers',
  moodReasonPhysical:   'physical mood triggers',
  avgStressNum:         'stress level',
  stressReasonInternal: 'internal stress triggers',
  stressReasonExternal: 'external stress triggers',
  stressReasonPhysical: 'physical stress triggers',
  napHours:             'nap duration',
  napStateNum:          'how rested after napping',
  medicationTaken:      'taking medication',
  medQualityNum:        'medication strength felt',
  focusQualityNum:      'focus quality on medication',
  focusCapacityHours:   'hours of medication focus',
  alcohol:              'alcohol consumed',
  actualCapacityRating: 'self-rated capacity',
  capacityScore:        'capacity score',
  totalEffortWeight:    'planned task effort',
  totalTimeSpent:       'total time worked',
  prevTimeSpent2day:    'time worked over the previous 2 days',
  prevTimeSpent3day:    'time worked over the previous 3 days',
  prevTimeSpent4day:    'time worked over the previous 4 days',
  prevSleep2dayAvg:     'average sleep over previous 2 nights',
  prevSleep3dayAvg:     'average sleep over previous 3 nights',
  prevMood2dayAvg:      'average mood over previous 2 days',
  taskCount:            'number of tasks',
  completionRate:       'task completion rate',
  postponedCount:       'tasks deferred',
  skippedClassCount:    'classes skipped',
  classTime:            'time in class',
  homeworkTime:         'time on homework',
  practiceTime:         'time practicing violin',
  projectsTime:         'time on personal projects',
  adminTime:            'time on admin tasks',
  maintenanceTime:      'time on maintenance',
  socialTime:           'time on social activities',
  classEffort:          'class effort',
  homeworkEffort:       'homework effort',
  practiceEffort:       'practice effort',
  projectsEffort:       'projects effort',
  adminEffort:          'admin effort',
  maintenanceEffort:    'maintenance effort',
  socialEffort:         'social effort',
}

// Variables grouped by type — correlations within the same family are filtered out
// because they're mathematically related or obviously circular
const FAMILIES = {
  sleep:      new Set(['sleepHours', 'sleepStateNum', 'sleepStartHour', 'sleepEndHour', 'prevSleep2dayAvg', 'prevSleep3dayAvg']),
  mood:       new Set(['avgMoodNum', 'moodReasonInternal', 'moodReasonExternal', 'moodReasonPhysical', 'prevMood2dayAvg']),
  stress:     new Set(['avgStressNum', 'stressReasonInternal', 'stressReasonExternal', 'stressReasonPhysical']),
  nap:        new Set(['napHours', 'napStateNum']),
  medication: new Set(['medicationTaken', 'medQualityNum', 'focusQualityNum', 'focusCapacityHours']),
  tasks:      new Set(['totalEffortWeight', 'totalTimeSpent', 'prevTimeSpent2day', 'prevTimeSpent3day', 'prevTimeSpent4day',
                       'taskCount', 'completionRate', 'postponedCount', 'skippedClassCount',
                       'classTime', 'homeworkTime', 'practiceTime', 'projectsTime', 'adminTime', 'maintenanceTime', 'socialTime',
                       'classEffort', 'homeworkEffort', 'practiceEffort', 'projectsEffort', 'adminEffort', 'maintenanceEffort', 'socialEffort']),
  outcome:    new Set(['alcohol', 'actualCapacityRating', 'capacityScore']),
}

const getFamily = (key) => {
  for (const [family, keys] of Object.entries(FAMILIES)) {
    if (keys.has(key)) return family
  }
  return null
}

// Variables that are direct inputs to the capacity score formula.
// Same-day correlations between these and capacityScore are circular — skip them.
const SCORE_INPUTS = new Set([
  'sleepHours', 'sleepStateNum', 'avgMoodNum', 'avgStressNum',
  'napHours', 'napStateNum', 'medQualityNum', 'focusQualityNum'
])

const isCircular = (keyA, keyB, lag) => {
  if (lag !== 0) return false
  if (keyA === 'capacityScore' && SCORE_INPUTS.has(keyB)) return true
  if (keyB === 'capacityScore' && SCORE_INPUTS.has(keyA)) return true
  return false
}

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

const rollingTaskTime = (logs, tasksByDate, i, nDays) => {
  if (i < nDays) return null
  let total = 0
  for (let d = 1; d <= nDays; d++) {
    const t = tasksByDate[logs[i - d]?.date] || []
    total += t.reduce((s, t) => s + (t.timeSpent || 0), 0)
  }
  return total > 0 ? total : null
}

const rollingSleepAvg = (logs, i, nDays) => {
  if (i < nDays) return null
  const vals = []
  for (let d = 1; d <= nDays; d++) {
    const h = logs[i - d]?.sleep?.hours
    if (h != null) vals.push(h)
  }
  return vals.length ? avg(vals) : null
}

const rollingMoodAvg = (logs, i, nDays) => {
  if (i < nDays) return null
  const vals = []
  for (let d = 1; d <= nDays; d++) {
    const entries = logs[i - d]?.moodLogs || []
    const v = entries.map(e => e.value).filter(Boolean)
    if (v.length) vals.push(avg(v.map(v => MOOD_MAP[v] ?? 0)))
  }
  return vals.length ? avg(vals) : null
}

const buildVectors = (logs, scoreMap, tasksByDate) => {
  return logs.map((log, i) => {
    const tasks = tasksByDate[log.date] || []
    const allMoodVals  = log.moodLogs?.map(e => e.value).filter(Boolean) || []
    const moodReasons  = reasonCategories(log.moodLogs)
    const allStressVals = log.stressLogs?.map(e => e.value).filter(Boolean) || []
    const stressReasons = reasonCategories(log.stressLogs)
    const napStates = log.naps?.map(n => SLEEP_MAP[n.feltRestedAfter] ?? null).filter(v => v != null) || []
    const medQVals  = log.medication?.medQuality ? [MED_MAP[log.medication.medQuality] ?? null].filter(v => v != null) : []
    const focQVals  = log.medication?.focusQuality ? [FOCUS_MAP[log.medication.focusQuality] ?? null].filter(v => v != null) : []
    const timeFor   = (cat) => { const t = tasks.filter(t => t.category === cat).reduce((s, t) => s + (t.timeSpent || 0), 0); return t > 0 ? t : null }
    const effortFor = (cat) => { const e = tasks.filter(t => t.category === cat).reduce((s, t) => s + (t.effortWeight || 0), 0); return e > 0 ? e : null }

    return {
      date: log.date,
      sleepHours:      log.sleep?.hours ?? null,
      sleepStateNum:   log.sleep?.state ? (SLEEP_MAP[log.sleep.state] ?? null) : null,
      sleepStartHour:  parseHour(log.sleep?.start),
      sleepEndHour:    parseHour(log.sleep?.end),
      avgMoodNum:      allMoodVals.length ? avg(allMoodVals.map(v => MOOD_MAP[v] ?? 0)) : null,
      moodReasonInternal: moodReasons.internal,
      moodReasonExternal: moodReasons.external,
      moodReasonPhysical: moodReasons.physical,
      avgStressNum:    allStressVals.length ? avg(allStressVals.map(v => STRESS_MAP[v] ?? 0)) : null,
      stressReasonInternal: stressReasons.internal,
      stressReasonExternal: stressReasons.external,
      stressReasonPhysical: stressReasons.physical,
      napHours:        log.naps?.length ? log.naps.reduce((s, n) => s + (n.hours || 0), 0) : null,
      napStateNum:     napStates.length ? avg(napStates) : null,
      medicationTaken: log.medication != null ? (log.medication.skipped ? 0 : 1) : null,
      medQualityNum:   medQVals.length ? medQVals[0] : null,
      focusQualityNum: focQVals.length ? focQVals[0] : null,
      focusCapacityHours: log.medication?.focusCapacityHours ?? null,
      alcohol:         log.alcohol ?? null,
      actualCapacityRating: log.actualCapacityRating ?? null,
      capacityScore:   scoreMap[log.date] ?? null,
      totalEffortWeight: tasks.length ? tasks.reduce((s, t) => s + (t.effortWeight || 0), 0) : null,
      totalTimeSpent:  tasks.length ? tasks.reduce((s, t) => s + (t.timeSpent || 0), 0) : null,
      taskCount:       tasks.length || null,
      completionRate:  tasks.length ? tasks.filter(t => t.completed).length / tasks.length : null,
      postponedCount:  tasks.reduce((s, t) => s + (t.timesPostponed || 0), 0) || null,
      skippedClassCount: tasks.filter(t => t.skippedClass).length || null,
      classTime: timeFor('class'), homeworkTime: timeFor('homework'), practiceTime: timeFor('practice'),
      projectsTime: timeFor('projects'), adminTime: timeFor('admin'), maintenanceTime: timeFor('maintenance'), socialTime: timeFor('social'),
      classEffort: effortFor('class'), homeworkEffort: effortFor('homework'), practiceEffort: effortFor('practice'),
      projectsEffort: effortFor('projects'), adminEffort: effortFor('admin'), maintenanceEffort: effortFor('maintenance'), socialEffort: effortFor('social'),
      prevTimeSpent2day: rollingTaskTime(logs, tasksByDate, i, 2),
      prevTimeSpent3day: rollingTaskTime(logs, tasksByDate, i, 3),
      prevTimeSpent4day: rollingTaskTime(logs, tasksByDate, i, 4),
      prevSleep2dayAvg: rollingSleepAvg(logs, i, 2),
      prevSleep3dayAvg: rollingSleepAvg(logs, i, 3),
      prevMood2dayAvg:  rollingMoodAvg(logs, i, 2),
    }
  })
}

const formatInsight = ({ keyA, keyB, lag, r, n }) => {
  const a = LABELS[keyA] || keyA
  const b = LABELS[keyB] || keyB
  const up = r > 0
  const strong = Math.abs(r) >= 0.65

  if (lag === 0) {
    return up
      ? `On days with ${strong ? 'notably' : 'slightly'} more ${a}, your ${b} also tends to be higher.`
      : `On days with ${strong ? 'notably' : 'slightly'} more ${a}, your ${b} tends to be lower.`
  }
  if (lag === 1) {
    return up
      ? `Higher ${a} tends to ${strong ? 'strongly' : 'slightly'} predict higher ${b} the following day.`
      : `Higher ${a} tends to ${strong ? 'strongly' : 'slightly'} predict lower ${b} the following day.`
  }
  return up
    ? `Higher ${a} tends to ${strong ? 'strongly' : 'slightly'} predict higher ${b} two days later.`
    : `Higher ${a} tends to ${strong ? 'strongly' : 'slightly'} predict lower ${b} two days later.`
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
      if (getFamily(keyA) && getFamily(keyA) === getFamily(keyB)) continue

      for (const lag of [0, 1, 2]) {
        // Skip same-day correlations between capacity score inputs and the score itself
        if (isCircular(keyA, keyB, lag)) continue

        const pairKey = lag === 0
          ? [keyA, keyB].sort().join('|') + '|0'
          : `${keyA}|${keyB}|${lag}`
        if (seen.has(pairKey)) continue
        seen.add(pairKey)

        const aVals = lag === 0 ? vectors.map(v => v[keyA]) : vectors.slice(0, -lag).map(v => v[keyA])
        const bVals = lag === 0 ? vectors.map(v => v[keyB]) : vectors.slice(lag).map(v => v[keyB])

        const { r, n } = pearson(aVals, bVals)
        if (r !== null && Math.abs(r) >= 0.5) {
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
