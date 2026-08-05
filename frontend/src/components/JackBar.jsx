import './JackBar.css'

// Renders capacity as a row of jacks, like a physical patch panel — each
// jack is either free, or lit in a tenant's assigned color. This is the
// visual signature of the app: channels are physical-feeling things, not
// just a percentage.
const PALETTE = ['#ff9d42', '#4ade80', '#60a5fa', '#f472b6', '#facc15', '#c084fc', '#2dd4bf', '#fb7185']

export function tenantColor(index) {
  return PALETTE[index % PALETTE.length]
}

export default function JackBar({ total, segments, maxJacks = 100 }) {
  // segments: [{ count, color, label }]
  const used = segments.reduce((s, seg) => s + seg.count, 0)
  const free = Math.max(0, total - used)

  // If the trunk is large (e.g. 500 channels), render as a proportional
  // bar with a legend instead of literally one box per channel.
  if (total > maxJacks) {
    return (
      <div className="jackbar jackbar--proportional">
        <div className="jackbar__track">
          {segments.map((seg, i) => (
            <div
              key={i}
              className="jackbar__seg"
              style={{ width: `${(seg.count / total) * 100}%`, background: seg.color }}
              title={`${seg.label}: ${seg.count}`}
            />
          ))}
        </div>
      </div>
    )
  }

  const cells = []
  segments.forEach((seg, i) => {
    for (let c = 0; c < seg.count; c++) {
      cells.push({ color: seg.color, label: seg.label })
    }
  })
  for (let c = 0; c < free; c++) cells.push(null)

  return (
    <div className="jackbar jackbar--grid">
      {cells.map((cell, i) => (
        <div
          key={i}
          className={'jack' + (cell ? ' jack--lit' : '')}
          style={cell ? { background: cell.color, boxShadow: `0 0 6px ${cell.color}88` } : undefined}
          title={cell ? cell.label : 'free channel'}
        />
      ))}
    </div>
  )
}
