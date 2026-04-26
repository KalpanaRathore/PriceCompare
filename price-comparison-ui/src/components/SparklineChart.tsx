interface SparklineChartProps {
  values: number[]
}

export function SparklineChart({ values }: SparklineChartProps) {
  if (values.length === 0) {
    return null
  }

  const width = 170
  const height = 64
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Price history chart"
    >
      <polyline points={points} />
    </svg>
  )
}
