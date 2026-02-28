'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  MapPin,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Briefcase,
} from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string
  email: string
  phone: string
  is_active: boolean
  venue: { id: string; name: string } | null
  active_tasks: number
  completed_today: number
  total_completed: number
}

const COLORS = [
  'from-blue-500 to-sky-500',
  'from-emerald-500 to-green-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-red-500',
  'from-cyan-500 to-teal-500',
  'from-indigo-500 to-violet-500',
  'from-lime-500 to-emerald-500',
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function StaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStaff = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const res = await fetch('/api/staff')
      if (res.ok) {
        const data = await res.json()
        setStaff(data.staff ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStaff()
    const interval = setInterval(() => fetchStaff(true), 30000)
    return () => clearInterval(interval)
  }, [fetchStaff])

  const totalActive = staff.filter((s) => s.is_active).length
  const totalBusy = staff.filter((s) => s.active_tasks > 0).length
  const totalTasksToday = staff.reduce((s, m) => s + m.completed_today, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'On Duty', value: totalActive, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Busy Now', value: totalBusy, icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Tasks Today', value: totalTasksToday, icon: Briefcase, color: 'text-sky-600 bg-sky-50' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-extrabold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Staff list */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Staff Management</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fetchStaff(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {staff.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No staff members found</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {staff.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 5, scale: 1.005 }}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-all border border-slate-100"
                >
                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${COLORS[index % COLORS.length]} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                    >
                      {getInitials(member.full_name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{member.full_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {member.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {member.venue.name}
                          </span>
                        )}
                        <span>•</span>
                        <span>{member.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: stats + status */}
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">
                        {member.active_tasks > 0 ? (
                          <span className="text-amber-600 font-semibold">{member.active_tasks} active</span>
                        ) : (
                          <span>{member.completed_today} tasks today</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">{member.total_completed} total</p>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-lg font-semibold text-sm shadow-sm ${member.active_tasks > 0
                          ? 'bg-amber-100 text-amber-700'
                          : member.is_active
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                    >
                      {member.active_tasks > 0
                        ? 'Busy'
                        : member.is_active
                          ? 'On Duty'
                          : 'Off Duty'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}