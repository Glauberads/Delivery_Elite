import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  isLive?: boolean
  trend?: string
}

export function MetricCard({ title, value, icon: Icon, isLive, trend }: MetricCardProps) {
  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        
        {isLive && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
            <motion.div 
              animate={{ opacity: [1, 0.5, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-2 h-2 rounded-full bg-primary" 
            />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Ao Vivo</span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <h3 className="text-sm font-medium text-text-muted mb-1">{title}</h3>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-white">{value}</span>
          {trend && (
            <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
