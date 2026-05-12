import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Monitor, Smartphone, Globe, User, MessageSquare } from 'lucide-react'
import { marketingSupabase } from '../../../lib/marketingSupabase'

interface Lead {
  id: string
  name: string | null
  email: string | null
  whatsapp: string | null
  message: string | null
  status: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  device: string | null
  browser: string | null
  created_at: string
}

interface LeadsTableProps {
  leads: Lead[]
}

const statusColors: Record<string, string> = {
  'Novo': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Em contato': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Qualificado': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Convertido': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Perdido': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusOptions = ['Novo', 'Em contato', 'Qualificado', 'Convertido', 'Perdido']

export function LeadsTable({ leads }: LeadsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setUpdatingId(leadId)
    try {
      await marketingSupabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    } catch (e) {
      console.error('Failed to update status', e)
    } finally {
      setUpdatingId(null)
    }
  }

  if (leads.length === 0) {
    return (
      <div className="bg-[#111118] border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
        <User className="w-12 h-12 text-white/10 mb-4" />
        <h3 className="text-lg font-bold text-white mb-1">Nenhum lead capturado ainda</h3>
        <p className="text-sm text-text-muted">Os leads aparecerão aqui em tempo real assim que os visitantes interagirem com a página.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-white/5 text-text-muted border-b border-white/10">
          <tr>
            <th className="px-6 py-4 font-medium">Data</th>
            <th className="px-6 py-4 font-medium">Contato</th>
            <th className="px-6 py-4 font-medium">Origem (UTM)</th>
            <th className="px-6 py-4 font-medium">Dispositivo</th>
            <th className="px-6 py-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {leads.map(lead => (
            <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-6 py-4">
                <span className="text-white">
                  {format(new Date(lead.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  {lead.name && <span className="font-bold text-white mb-1">{lead.name}</span>}
                  {lead.whatsapp && (
                    <span className="text-text-muted text-xs flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {lead.whatsapp}
                    </span>
                  )}
                  {!lead.name && !lead.whatsapp && <span className="text-text-muted italic">Apenas Clique</span>}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col text-xs">
                  <span className="text-white">{lead.utm_source || 'Direto'}</span>
                  <span className="text-text-muted">{lead.utm_campaign || '-'}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3 text-text-muted">
                  {lead.device === 'Desktop' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                  {lead.browser === 'Chrome' ? <Globe className="w-4 h-4" /> : <span className="text-xs">{lead.browser}</span>}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="relative">
                  <select
                    disabled={updatingId === lead.id}
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    className={`appearance-none border px-3 py-1.5 pr-8 rounded-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 cursor-pointer ${statusColors[lead.status] || 'bg-white/5 text-white border-white/10'}`}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt} value={opt} className="bg-[#111118] text-white">{opt}</option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
