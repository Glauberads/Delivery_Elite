import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface Event {
  utm_source: string | null
}

interface TrafficSourcesChartProps {
  events: Event[]
}

const COLORS = ['#EA1D2C', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280']

export function TrafficSourcesChart({ events }: TrafficSourcesChartProps) {
  const data = useMemo(() => {
    // We only care about PageView events for sources, but since we get mixed events, we can just aggregate all unique visitors' sources or all events.
    // Assuming events is an array of page_events.
    const sourcesCount: Record<string, number> = {}
    
    events.forEach(ev => {
      const source = ev.utm_source || 'Direto / Orgânico'
      sourcesCount[source] = (sourcesCount[source] || 0) + 1
    })

    const chartData = Object.keys(sourcesCount).map(key => ({
      name: key,
      value: sourcesCount[key]
    })).sort((a, b) => b.value - a.value)

    return chartData.slice(0, 5) // Top 5 sources
  }, [events])

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-text-muted">
        Nenhum dado de tráfego ainda.
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
