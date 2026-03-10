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
  ChevronDown,
  X,
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

interface Venue {
  id: string
  name: string
  city: string
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
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [showAssignDropdown, setShowAssignDropdown] = useState<string | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [staffRes, venuesRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/locations'),
      ])

      if (staffRes.ok) {
        const data = await staffRes.json()
        setStaff(data.staff ?? [])
      }
      if (venuesRes.ok) {
        const data = await venuesRes.json()
        setVenues(data.locations ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAssignVenue = async (staffId: string, venueId: string | null) => {
    try {
      setAssigningId(staffId)
      const res = await fetch('/api/staff/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, venue_id: venueId }),
      })

      if (res.ok) {
        await fetchData(true)
      }
    } catch (err) {
      console.error('Failed to assign staff:', err)
    } finally {
      setAssigningId(null)
      setShowAssignDropdown(null)
    }
  }

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
          { label: 'On Duty', value: totalActive, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Busy Now', value: totalBusy, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Tasks Today', value: totalTasksToday, icon: Briefcase, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Staff list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Staff Management</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all border border-slate-100 dark:border-slate-700"
                >
                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${COLORS[index % COLORS.length]} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                    >
                      {getInitials(member.full_name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{member.full_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {/* Venue assignment with dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setShowAssignDropdown(
                              showAssignDropdown === member.id ? null : member.id
                            )}
                            className="flex items-center gap-1 hover:text-sky-600 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>{member.venue?.name || 'Unassigned'}</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>

                          {showAssignDropdown === member.id && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 py-1">
                              <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">
                                Assign to Venue
                              </div>
                              {venues.map((venue) => (
                                <button
                                  key={venue.id}
                                  onClick={() => handleAssignVenue(member.id, venue.id)}
                                  disabled={assigningId === member.id}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors flex items-center justify-between ${member.venue?.id === venue.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                  <span>{venue.name}</span>
                                  {member.venue?.id === venue.id && (
                                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                                  )}
                                </button>
                              ))}
                              {member.venue && (
                                <>
                                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                                  <button
                                    onClick={() => handleAssignVenue(member.id, null)}
                                    disabled={assigningId === member.id}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    Unassign
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <span>•</span>
                        <span>{member.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: stats + status */}
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {member.active_tasks > 0 ? (
                          <span className="text-amber-600 font-semibold">{member.active_tasks} active</span>
                        ) : (
                          <span>{member.completed_today} tasks today</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{member.total_completed} total</p>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-lg font-semibold text-sm shadow-sm ${member.active_tasks > 0
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        : member.is_active
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
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