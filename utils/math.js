const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

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

module.exports = { avg, pearson }
