'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  TrendingUp,
  Star,
  BarChart3,
  Car,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Banknote,
  ParkingCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useRealtime } from '@/hooks/useRealtime'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface Session {
  id: string
  status: 'active' | 'completed'
  entry_time: string
  exit_time: string | null
  duration: string | null
  rate_per_hour: number
  total_hours: number | null
  total_amount: number | null
  payment_status: string
  vehicle: {
    license_plate: string
    make: string | null
    model: string | null
    color: string | null
  }
  slot: {
    slot_number: string
    floor_level: string | null
    zone: string | null
  } | null
  venue: {
    id: string
    name: string
    city: string
  }
  staff_name: string | null
  customer_name: string | null
}

interface ActivityItem {
  text: string
  time: string
  type: 'checkin' | 'checkout' | 'payment'
}

// ──────────────────────────────────────────────────────────────────────────────
// Animations
// ──────────────────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-PK', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function OverviewTab({ hideRevenue = false }: { hideRevenue?: boolean } = {}) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      // Fetch active + all sessions in parallel
      const [activeRes, allRes] = await Promise.all([
        fetch('/api/sessions?status=active'),
        fetch('/api/sessions?status=all'),
      ])

      if (activeRes.ok) {
        const data = await activeRes.json()
        setSessions(data.sessions ?? [])
      }
      if (allRes.ok) {
        const data = await allRes.json()
        setAllSessions(data.sessions ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch overview data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time updates via SSE
  useRealtime(useCallback((event) => {
    if (event.table === 'parking_sessions' || event.table === 'transactions' || event.table === 'service_requests') {
      fetchData(true);
    }
  }, [fetchData]), ['parking_sessions', 'transactions', 'service_requests']);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const activeSessions = sessions.length
  const completedToday = allSessions.filter((s) => {
    if (s.status !== 'completed' || !s.exit_time) return false
    return new Date(s.exit_time).toDateString() === new Date().toDateString()
  }).length

  const todayRevenue = allSessions
    .filter((s) => {
      if (s.status !== 'completed' || !s.exit_time) return false
      return new Date(s.exit_time).toDateString() === new Date().toDateString()
    })
    .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)

  const totalRevenue = allSessions
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)

  // ── Build activity feed from real sessions ────────────────────────────────

  const activityFeed: ActivityItem[] = allSessions
    .slice(0, 15)
    .flatMap((s) => {
      const items: ActivityItem[] = []

      // Check-in event
      items.push({
        text: `${s.vehicle.license_plate} checked in at ${s.venue.name}${s.slot ? ` → ${s.slot.slot_number}` : ''}`,
        time: `${formatDate(s.entry_time)} ${formatTime(s.entry_time)}`,
        type: 'checkin',
      })

      // Checkout event (if completed)
      if (s.status === 'completed' && s.exit_time) {
        items.push({
          text: `${s.vehicle.license_plate} checked out — Rs.${Math.round(s.total_amount ?? 0)} (${s.duration})`,
          time: `${formatDate(s.exit_time)} ${formatTime(s.exit_time)}`,
          type: 'checkout',
        })
      }

      return items
    })
    .sort((a, b) => {
      // Most recent first — a rough sort since time strings are formatted
      return 0
    })
    .slice(0, 10)

  // ── Venue breakdown ───────────────────────────────────────────────────────

  const venueMap = new Map<string, { name: string; active: number; completed: number; revenue: number }>()
  allSessions.forEach((s) => {
    const key = s.venue.id
    const existing = venueMap.get(key) ?? { name: s.venue.name, active: 0, completed: 0, revenue: 0 }
    if (s.status === 'active') existing.active++
    if (s.status === 'completed') {
      existing.completed++
      existing.revenue += s.total_amount ?? 0
    }
    venueMap.set(key, existing)
  })
  const venueBreakdown = Array.from(venueMap.values()).sort((a, b) => b.active - a.active)

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            label: 'Active Now',
            value: activeSessions,
            icon: Car,
            color: 'from-sky-500 to-blue-600',
          },
          {
            label: 'Completed Today',
            value: completedToday,
            icon: ArrowDownLeft,
            color: 'from-emerald-500 to-green-600',
          },
          ...(!hideRevenue
            ? [
              {
                label: "Today's Revenue",
                value: `Rs.${Math.round(todayRevenue).toLocaleString()}`,
                icon: Banknote,
                color: 'from-violet-500 to-purple-600',
              },
            ]
            : []),

        ].map((card, i) => (
          <motion.div
            key={card.label}
            variants={itemVariants}
            whileHover={{ y: -3, scale: 1.02 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {card.label}
                </p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{card.value}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}
              >
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Activity Feed */}
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Live Activity</h2>
            </div>
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

          {activityFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Activity className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs mt-0.5">Check in a vehicle to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {activityFeed.map((act, index) => (
                  <motion.div
                    key={`${act.text}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div
                      className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.type === 'checkin'
                        ? 'bg-sky-100 dark:bg-sky-900/30'
                        : act.type === 'checkout'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-violet-100 dark:bg-violet-900/30'
                        }`}
                    >
                      {act.type === 'checkin' ? (
                        <ArrowUpRight className="w-4 h-4 text-sky-600" />
                      ) : act.type === 'checkout' ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Banknote className="w-4 h-4 text-violet-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{act.text}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{act.time}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Active Vehicles */}
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ParkingCircle className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Parked Vehicles
                {activeSessions > 0 && (
                  <span className="ml-2 text-sm font-semibold text-sky-600 bg-sky-50 dark:bg-sky-900/30 px-2 py-0.5 rounded-full">
                    {activeSessions}
                  </span>
                )}
              </h2>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Car className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-medium">No vehicles parked</p>
              <p className="text-xs mt-0.5">Check in a vehicle to see it here</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {sessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                      <Car className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{s.vehicle.license_plate}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {[s.vehicle.color, s.vehicle.make, s.vehicle.model]
                          .filter(Boolean)
                          .join(' ') || 'Unknown vehicle'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">
                        {s.slot?.slot_number ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {s.duration ?? '0m'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Venue Breakdown ─────────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Venue Breakdown</h2>
          </div>
        </div>

        {venueBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No data yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venueBreakdown.map((venue, i) => (
              <motion.div
                key={venue.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-100 dark:border-sky-800"
              >
                <h3 className="font-bold text-slate-900 dark:text-white mb-3">{venue.name}</h3>
                <div className={`grid ${hideRevenue ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Active</p>
                    <p className="text-xl font-extrabold text-sky-600">{venue.active}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
                    <p className="text-xl font-extrabold text-emerald-600">{venue.completed}</p>
                  </div>
                  {!hideRevenue && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Revenue</p>
                      <p className="text-lg font-extrabold text-violet-600 dark:text-violet-400">
                        Rs.{Math.round(venue.revenue).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}