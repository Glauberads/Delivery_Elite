import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, MousePointerClick, MessageCircle, Eye, ArrowDownToLine } from 'lucide-react'

interface PageEvent {
  id: string
  event_type: string
  event_name: string
  created_at: string
}

interface RealtimeActivityProps {
  events: PageEvent[]
}

export function RealtimeActivity({ events }: RealtimeActivityProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'PageView': return <Eye className="w-4 h-4 text-blue-400" />
      case 'Click': return <MousePointerClick className="w-4 h-4 text-emerald-400" />
      case 'Lead': return <MessageCircle className="w-4 h-4 text-primary" />
      case 'Scroll': return <ArrowDownToLine className="w-4 h-4 text-purple-400" />
      default: return <Activity className="w-4 h-4 text-text-muted" />
    }
  }

  if (events.length === 0) {
    return (
      <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 text-center text-text-muted text-sm">
        Nenhuma atividade recente.
      </div>
    )
  }

  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Timeline ao Vivo
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6">
        <div className="relative border-l border-white/10 ml-3 space-y-6 pb-4">
          {events.map((ev) => (
            <div key={ev.id} className="relative pl-6">
              {/* Event Node */}
              <div className="absolute -left-3.5 top-0 w-7 h-7 bg-[#111118] border-2 border-white/10 rounded-full flex items-center justify-center">
                {getEventIcon(ev.event_type)}
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">{ev.event_name}</span>
                <span className="text-xs text-text-muted">
                  Há {formatDistanceToNow(new Date(ev.created_at), { locale: ptBR })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
