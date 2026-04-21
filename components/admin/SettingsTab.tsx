'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  CreditCard,
  Database,
  Server,
  Loader2,
  RefreshCw,
  Shield,
  HardDrive,
  Clock,
  Download,
} from 'lucide-react'
import DynamicPricingCard from './DynamicPricingCard'

interface SystemStats {
  venues: { total: number; active: number }
  slots: { total: number; occupied: number; available: number; occupancy_rate: number }
  sessions: { total: number; active: number; completed: number; avg_duration_hours: number }
  staff: { total: number; active: number; assigned: number }
  customers: { total: number }
  revenue: { total: number; today: number }
  system: { database: string; anpr_service: string; uptime: number }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function SettingsTab() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExportSales = async () => {
    try {
      setExporting(true)
      const res = await fetch('/api/admin/export-sales')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `parkflow_sales_export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } else {
        alert('Failed to export sales data')
      }
    } catch (err) {
      console.error('Export error:', err)
      alert('An error occurred while exporting.')
    } finally {
      setExporting(false)
    }
  }

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch system stats:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(() => fetchStats(true), 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    )
  }

  const systemServices = [
    {
      icon: Brain,
      title: 'AI Recognition System',
      status: stats.system.anpr_service === 'active' ? 'Active' : 'Offline',
      statusColor: stats.system.anpr_service === 'active' ? 'bg-emerald-500' : 'bg-red-500',
      color: 'from-blue-500 to-sky-500',
    },
    {
      icon: Database,
      title: 'Database (PostgreSQL)',
      status: stats.system.database === 'connected' ? 'Connected' : 'Disconnected',
      statusColor: stats.system.database === 'connected' ? 'bg-emerald-500' : 'bg-red-500',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Server,
      title: 'Application Server',
      status: 'Running',
      statusColor: 'bg-emerald-500',
      color: 'from-green-500 to-emerald-500',
    },
  ]

  const systemMetrics = [
    {
      icon: HardDrive,
      label: 'Slot Occupancy',
      value: `${stats.slots.occupancy_rate}%`,
      color: stats.slots.occupancy_rate > 80 ? 'text-red-600' : stats.slots.occupancy_rate > 50 ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      icon: Shield,
      label: 'Staff Coverage',
      value: `${stats.staff.assigned}/${stats.staff.total}`,
      color: 'text-sky-600',
    },
    {
      icon: Clock,
      label: 'Avg. Session',
      value: (() => {
        const h = Math.floor(stats.sessions.avg_duration_hours)
        const m = Math.round((stats.sessions.avg_duration_hours - h) * 60)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
      })(),
      color: 'text-purple-600',
    },
    {
      icon: CreditCard,
      label: 'Total Revenue',
      value: `Rs.${Math.round(stats.revenue.total).toLocaleString()}`,
      color: 'text-emerald-600',
    },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExportSales}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export Sales Data
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* System Services */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">System Services</h2>

        <div className="space-y-4">
          {systemServices.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{ x: 5, scale: 1.01 }}
              className="flex items-center justify-between p-5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all border border-slate-100 dark:border-slate-700"
            >
              <div className="flex items-center space-x-4">
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center shadow-lg`}
                >
                  <service.icon className="w-6 h-6 text-white" />
                </motion.div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{service.title}</p>
                </div>
              </div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`px-5 py-2 ${service.statusColor} text-white rounded-lg font-semibold text-sm shadow-sm`}
              >
                {service.status}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* System Metrics */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">System Metrics</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.5 }}
              whileHover={{ y: -3, scale: 1.02 }}
              className="p-5 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</span>
              </div>
              <p className={`text-2xl font-extrabold ${metric.color}`}>{metric.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Dynamic Pricing */}
      <motion.div variants={itemVariants}>
        <DynamicPricingCard />
      </motion.div>

      {/* Database Info */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Database Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Venues', value: stats.venues.total, active: stats.venues.active },
            { label: 'Parking Slots', value: stats.slots.total, active: stats.slots.available },
            { label: 'Staff Members', value: stats.staff.total, active: stats.staff.active },
            { label: 'Customers', value: stats.customers.total, active: null },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 + 0.6 }}
              className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-700/30 border border-slate-200 dark:border-slate-600"
            >
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{item.value}</p>
              {item.active !== null && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {item.active} {item.label === 'Parking Slots' ? 'available' : 'active'}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}