export function MetricGrid({ items }: { items: Array<{ label: string; value: string | number; note: string }> }) {
  return <div className="metric-grid">{items.map((item) => <div className="metric" key={item.label}><div className="metric-label">{item.label}</div><div className="metric-value">{item.value}</div><div className="metric-note">{item.note}</div></div>)}</div>;
}
