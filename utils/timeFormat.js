const fmtHours = (hours) => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const fmtMinutes = (mins) => fmtHours(mins / 60)

module.exports = { fmtHours, fmtMinutes }
