'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User } from 'lucide-react'
import OverviewTab from '@/components/admin/OverviewTab'
import AnalyticsTab from '@/components/admin/AnalyticsTab'
import StaffTab from '@/components/admin/StaffTab'
import SettingsTab from '@/components/admin/SettingsTab'
import LocationsTab from '@/components/admin/LocationsTab'
import ANPRDetector from '@/components/anpr/ANPRDetector'
import LiveFeedWidget from '@/components/admin/LiveFeedWidget'
import DarkModeToggle from '@/components/DarkModeToggle'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Overview')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Guard: only allow admin role to access this page
  useEffect(() => {
    let cancelled = false

    const checkRole = async () => {
      try {
        const res = await fetch('/api/staff/me')

        if (!res.ok) {
          if (!cancelled) {
            router.push('/login')
          }
          return
        }

        const data = await res.json()
        const role = data.staff?.role

        if (!cancelled) {
          if (role !== 'admin') {
            router.push('/staff')
            return
          }
          setAuthChecked(true)
        }
      } catch (error) {
        console.error('Admin auth check failed:', error)
        if (!cancelled) {
          router.push('/login')
        }
      }
    }

    checkRole()

    return () => {
      cancelled = true
    }
  }, [router])

  const tabs = ['Overview', 'Analytics', 'Staff', 'Locations', 'Live Feed', 'ANPR', 'Settings']

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (response.ok) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  }

  const tabContentVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
    exit: {
      opacity: 0,
      x: 20,
      transition: { duration: 0.3 },
    },
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="text-slate-500 dark:text-slate-400 text-sm">
          Checking admin access…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container-custom py-5 sm:py-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          {/* Left: badge + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
              <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">Admin</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                Admin Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">ParkFlow Management Console</p>
            </div>
          </div>

          {/* Right: Live + DarkMode + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <DarkModeToggle />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg shadow-lg"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-white rounded-full"
              />
              <span className="font-semibold text-sm">Live</span>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Tabs Navigation — scrollable on mobile */}
        <motion.div
          variants={itemVariants}
          className="mb-6 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-none"
        >
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`shrink-0 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === tab
                  ? 'bg-sky-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
              >
                {tab}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {activeTab === 'Overview' && <OverviewTab />}
            {activeTab === 'Analytics' && <AnalyticsTab />}
            {activeTab === 'Staff' && <StaffTab />}
            {activeTab === 'Settings' && <SettingsTab />}
            {activeTab === 'Locations' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-6 shadow-sm">
                <LocationsTab />
              </div>
            )}
            {activeTab === 'Live Feed' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-6 shadow-sm">
                <LiveFeedWidget />
              </div>
            )}
            {activeTab === 'ANPR' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-6 shadow-sm">
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">License Plate Recognition</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Upload an image or use your camera to detect and read Pakistani license plates using the AI model.
                  </p>
                </div>
                <ANPRDetector />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}