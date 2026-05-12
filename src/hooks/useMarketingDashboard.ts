import { useState, useEffect } from 'react'
import { marketingSupabase } from '../lib/marketingSupabase'

export function useMarketingDashboard() {
  const [leads, setLeads] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [onlineVisitors, setOnlineVisitors] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Initial Fetch
    const fetchData = async () => {
      setLoading(true)
      
      const [leadsRes, eventsRes, visitorsRes] = await Promise.all([
        marketingSupabase.from('leads').select('*').order('created_at', { ascending: false }).limit(50),
        marketingSupabase.from('page_events').select('*').order('created_at', { ascending: false }).limit(50),
        // Conta visitantes com last_seen nos últimos 2 minutos
        marketingSupabase.from('visitors').select('id', { count: 'exact' })
          .gte('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      ])

      if (leadsRes.data) setLeads(leadsRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
      if (visitorsRes.count !== null) setOnlineVisitors(visitorsRes.count)
      
      setLoading(false)
    }

    fetchData()

    // Intervalo para atualizar contagem de visitantes online a cada 10s
    const visitorsInterval = setInterval(async () => {
      const { count } = await marketingSupabase.from('visitors').select('id', { count: 'exact' })
        .gte('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      if (count !== null) setOnlineVisitors(count)
    }, 10000)

    // 2. Realtime Subscriptions
    const leadsSub = marketingSupabase.channel('public:leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, payload => {
        setLeads(prev => [payload.new, ...prev].slice(0, 50))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, payload => {
        setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l))
      })
      .subscribe()

    const eventsSub = marketingSupabase.channel('public:page_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_events' }, payload => {
        setEvents(prev => [payload.new, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => {
      clearInterval(visitorsInterval)
      marketingSupabase.removeChannel(leadsSub)
      marketingSupabase.removeChannel(eventsSub)
    }
  }, [])

  return { leads, setLeads, events, onlineVisitors, loading }
}
