'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Banknote,
  Car,
  Users,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
  ParkingCircle,
  Star,
  Award,
} from 'lucide-react'

interface DailyRevenue { day: string; date: string; sessions: number; revenue: number }
interface TopStaff { name: string; completed: number; avgHours: number | null; avgRating: number }

interface AnalyticsData {
  totalRevenue: number
  todayRevenue: number
  totalSessions: number
  activeSessions: number
  completedSessions: number
  todayCompleted: number
  avgDurationHours: number
  totalCustomers: number
  totalStaff: number
  totalSlots: number
  occupiedSlots: number
  venues: {
    name: string
    active: number
    completed: number
    revenue: number
    totalSlots: number
    occupiedSlots: number
  }[]
  hourlyBreakdown: { hour: string; count: number }[]
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([])
  const [topStaff, setTopStaff] = useState<TopStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [sessionsRes, staffRes, statsRes, analyticsRes] = await Promise.all([
        fetch('/api/sessions?status=all'),
        fetch('/api/staff'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/analytics'),
      ])

      const sessionsData = await sessionsRes.json()
      const staffData = await staffRes.json()
      const statsData = statsRes.ok ? await statsRes.json() : null
      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : null
      if (analyticsData?.dailyRevenue) setDailyRevenue(analyticsData.dailyRevenue)
      if (analyticsData?.topStaff) setTopStaff(analyticsData.topStaff)
      const sessions = sessionsData.sessions ?? []
      const staff = staffData.staff ?? []
      const today = new Date().toDateString()

      const active = sessions.filter((s: { status: string }) => s.status === 'active')
      const completed = sessions.filter((s: { status: string }) => s.status === 'completed')
      const todayCompleted = completed.filter(
        (s: { exit_time: string }) => s.exit_time && new Date(s.exit_time).toDateString() === today
      )

      const totalRevenue = completed.reduce(
        (sum: number, s: { total_amount: number | null }) => sum + (s.total_amount ?? 0),
        0
      )
      const todayRevenue = todayCompleted.reduce(
        (sum: number, s: { total_amount: number | null }) => sum + (s.total_amount ?? 0),
        0
      )
      const avgDuration =
        completed.length > 0
          ? completed.reduce(
            (sum: number, s: { total_hours: number | null }) => sum + (s.total_hours ?? 0),
            0
          ) / completed.length
          : 0

      // Unique customers (by customer_name)
      const uniqueCustomers = new Set(
        sessions
          .map((s: { customer_name: string | null }) => s.customer_name)
          .filter(Boolean)
      ).size

      // Venue breakdown
      const venueMap = new Map<
        string,
        { name: string; active: number; completed: number; revenue: number; totalSlots: number; occupiedSlots: number }
      >()
      sessions.forEach(
        (s: {
          venue: { id: string; name: string }
          status: string
          total_amount: number | null
        }) => {
          const key = s.venue.id
          const existing = venueMap.get(key) ?? {
            name: s.venue.name,
            active: 0,
            completed: 0,
            revenue: 0,
            totalSlots: 0,
            occupiedSlots: 0,
          }
          if (s.status === 'active') existing.active++
          if (s.status === 'completed') {
            existing.completed++
            existing.revenue += s.total_amount ?? 0
          }
          venueMap.set(key, existing)
        }
      )

      // Hourly breakdown of check-ins (all time)
      const hourCounts: Record<string, number> = {}
      sessions.forEach((s: { entry_time: string }) => {
        const h = new Date(s.entry_time).getHours()
        const label = `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`
        hourCounts[label] = (hourCounts[label] || 0) + 1
      })
      const hourlyBreakdown = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => {
          // Sort by actual hour
          const getH = (h: string) => {
            const match = h.match(/^(\d+)/)
            const isPM = h.includes('PM')
            let n = parseInt(match?.[1] ?? '0')
            if (isPM && n !== 12) n += 12
            if (!isPM && n === 12) n = 0
            return n
          }
          return getH(a.hour) - getH(b.hour)
        })

      setData({
        totalRevenue,
        todayRevenue,
        totalSessions: sessions.length,
        activeSessions: active.length,
        completedSessions: completed.length,
        todayCompleted: todayCompleted.length,
        avgDurationHours: avgDuration,
        totalCustomers: uniqueCustomers,
        totalStaff: staff.length,
        totalSlots: statsData?.slots?.total ?? 0,
        occupiedSlots: statsData?.slots?.occupied ?? 0,
        venues: Array.from(venueMap.values()),
        hourlyBreakdown,
      })
    } catch (err) {
      console.error('Analytics fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(() => fetchAnalytics(true), 30000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    )
  }

  const avgH = Math.floor(data.avgDurationHours)
  const avgM = Math.round((data.avgDurationHours - avgH) * 60)
  const avgDisplay = avgH > 0 ? `${avgH}h ${avgM}m` : `${avgM}m`

  const metrics = [
    {
      icon: Banknote,
      label: 'Total Revenue',
      value: `Rs.${data.totalRevenue.toLocaleString()}`,
      sub: `Rs.${data.todayRevenue.toLocaleString()} today`,
      color: 'from-violet-500 to-purple-600',
    },
    {
      icon: Car,
      label: 'Total Sessions',
      value: data.totalSessions.toString(),
      sub: `${data.activeSessions} active, ${data.completedSessions} completed`,
      color: 'from-sky-500 to-blue-600',
    },
    {
      icon: Users,
      label: 'Customers Served',
      value: data.totalCustomers.toString(),
      sub: `${data.totalStaff} staff members`,
      color: 'from-emerald-500 to-green-600',
    },
    {
      icon: Clock,
      label: 'Avg. Duration',
      value: avgDisplay,
      sub: `${data.todayCompleted} completed today`,
      color: 'from-amber-500 to-orange-600',
    },
    {
      icon: ParkingCircle,
      label: 'Slot Occupancy',
      value: data.totalSlots > 0 ? `${Math.round((data.occupiedSlots / data.totalSlots) * 100)}%` : '0%',
      sub: `${data.occupiedSlots}/${data.totalSlots} slots occupied`,
      color: 'from-rose-500 to-red-600',
    },
  ]

  const maxHourCount = Math.max(...data.hourlyBreakdown.map((h) => h.count), 1)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Refresh button */}
      <div className="flex justify-end">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => fetchAnalytics(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -3, scale: 1.02 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {metric.label}
                </p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{metric.value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{metric.sub}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center shadow-lg`}
              >
                <metric.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-in Hours Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Check-in Hours</h2>
          </div>

          {data.hourlyBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.hourlyBreakdown.map((h, i) => (
                <motion.div
                  key={h.hour}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{h.hour}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{h.count} vehicles</span>
                  </div>
                  <div className="relative h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(h.count / maxHourCount) * 100}%` }}
                      transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-blue-500 rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Venue Occupancy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-5">
            <ParkingCircle className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Venue Performance</h2>
          </div>

          {data.venues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ParkingCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.venues.map((v, i) => (
                <motion.div
                  key={v.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-100 dark:border-sky-900/50"
                >
                  <h3 className="font-bold text-slate-900 dark:text-white mb-3">{v.name}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Active</p>
                      <p className="text-xl font-extrabold text-sky-600">{v.active}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
                      <p className="text-xl font-extrabold text-emerald-600">{v.completed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Revenue</p>
                      <p className="text-lg font-extrabold text-violet-600">
                        Rs.{v.revenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Trend (last 7 days) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-5">
            <Banknote className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Revenue — Last 7 Days</h2>
          </div>

          {dailyRevenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No revenue data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const maxRev = Math.max(...dailyRevenue.map((d) => d.revenue), 1)
                return dailyRevenue.map((d, i) => (
                  <motion.div
                    key={d.date}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{d.day}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-violet-600">
                          Rs.{Number(d.revenue).toLocaleString()}
                        </span>
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{d.sessions} sessions</span>
                      </div>
                    </div>
                    <div className="relative h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.revenue / maxRev) * 100}%` }}
                        transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                      />
                    </div>
                  </motion.div>
                ))
              })()}
            </div>
          )}
        </motion.div>

        {/* Top Staff Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top Performers</h2>
          </div>

          {topStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Users className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No staff data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topStaff.map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-400">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {s.completed} completed
                        {s.avgHours != null && ` • avg ${s.avgHours}h`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className={`w-4 h-4 ${s.avgRating > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {s.avgRating > 0 ? s.avgRating.toFixed(1) : '—'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}