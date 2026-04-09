'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User } from 'lucide-react'
import OverviewTab from '@/components/admin/OverviewTab'
import AnalyticsTab from '@/components/admin/AnalyticsTab'
import StaffTab from '@/components/admin/StaffTab'
import SettingsTab from '@/components/admin/SettingsTab'
import LocationsTab from '@/components/admin/LocationsTab'
import CustomerSearchTab from '@/components/admin/CustomerSearchTab'
import ANPRDetector from '@/components/anpr/ANPRDetector'
import LiveFeedWidget from '@/components/admin/LiveFeedWidget'
import DarkModeToggle from '@/components/DarkModeToggle'
import { getDashboardPath, getRoleLabel } from '@/lib/roles'
import {
  ShiftStartGate,
  ShiftStatusBar,
  ShiftSummaryModal,
} from "@/components/shared/shift";
import { useShift } from "@/components/shared/shift/useShift";
import { Clock, Loader2, XCircle } from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Overview')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'supervisor'>('admin')
  const [staffData, setStaffData] = useState<any>(null)

  // ── Shift state (for supervisors) ─────────────────────────────────────────
  const {
    shiftStatus,
    activeShift,
    venueConfig,
    actionLoading: shiftActionLoading,
    shiftSummary,
    setShiftSummary,
    handleStartShift,
    handleBreakStart,
    handleBreakEnd,
    handleEndShift,
    resetShift,
  } = useShift();

  // Guard: only allow admin or supervisor to access this page
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
          if (role !== 'admin' && role !== 'supervisor') {
            router.push(getDashboardPath(role))
            return
          }
          setUserRole(role as 'admin' | 'supervisor')
          setStaffData(data.staff)
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

  const isSupervisor = userRole === 'supervisor'

  // Supervisor sees: Overview, Staff, Locations (read-only), Live Feed, ANPR
  // Admin sees all 7 tabs
  const ALL_TABS = ['Overview', 'Analytics', 'Staff', 'Customers', 'Locations', 'Live Feed', 'Settings']
  const SUPERVISOR_HIDDEN = ['Analytics', 'Settings', 'Locations']

  const tabs = useMemo(
    () => isSupervisor ? ALL_TABS.filter((t) => !SUPERVISOR_HIDDEN.includes(t)) : ALL_TABS,
    [isSupervisor]
  )

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
        {/* Shift Start Gate — blocks dashboard until shift started */}
        <AnimatePresence>
          {isSupervisor && shiftStatus === "none" && staffData && (
            <ShiftStartGate
              staffName={staffData.full_name}
              venueName={staffData.venue?.name ?? "Your Venue"}
              venueCity={staffData.venue?.city ?? ""}
              config={venueConfig}
              onStart={handleStartShift}
              starting={shiftActionLoading === "start"}
            />
          )}
        </AnimatePresence>

        {/* Pending Approval Overlay — blocks dashboard, auto-polls for approval */}
        <AnimatePresence>
          {isSupervisor && shiftStatus === "pending_approval" && (
            <motion.div
              key="pending-approval"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.92, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-red-300 dark:border-red-700 max-w-md w-full p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                  Awaiting Admin Approval
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">
                  You were{" "}
                  <span className="font-semibold text-red-500">
                    {activeShift?.late_minutes ?? 0} minutes late
                  </span>{" "}
                  to your shift.
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mb-6">
                  Your manager has been notified. The dashboard will unlock automatically once approved.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking for approval every 30 seconds…
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rejected Overlay */}
        <AnimatePresence>
          {isSupervisor && shiftStatus === "rejected" && (
            <motion.div
              key="rejected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.92, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-red-400 dark:border-red-600 max-w-md w-full p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                  Shift Rejected
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  Your shift request has been rejected by your manager. Please report to your manager for further instructions.
                </p>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  Logout
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shift Summary Modal */}
        <AnimatePresence>
          {isSupervisor && shiftSummary && (
            <ShiftSummaryModal
              summary={shiftSummary}
              staffName={staffData?.full_name ?? "Staff"}
              onDone={resetShift}
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          {/* Left: badge + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
              <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{getRoleLabel(userRole)}</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                {isSupervisor ? `Supervisor: ${staffData?.full_name}` : 'Admin Dashboard'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {isSupervisor ? staffData?.venue?.name || 'No Venue Assigned' : 'ParkFlow Management Console'}
              </p>
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

        {/* Shift Status Bar — shown when shift is active or on_break */}
        <AnimatePresence>
          {isSupervisor && (shiftStatus === "active" || shiftStatus === "on_break") && activeShift && (
            <motion.div variants={itemVariants}>
              <ShiftStatusBar
                shift={activeShift}
                config={venueConfig}
                onBreakStart={handleBreakStart}
                onBreakEnd={handleBreakEnd}
                onEndShift={handleEndShift}
                actionLoading={shiftActionLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

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
            {activeTab === 'Overview' && <OverviewTab hideRevenue={isSupervisor} />}
            {activeTab === 'Analytics' && !isSupervisor && <AnalyticsTab />}
            {activeTab === 'Staff' && (
              <StaffTab
                isSupervisor={isSupervisor}
                supervisorVenueId={staffData?.venue?.id}
                supervisorName={staffData?.full_name}
                venueName={staffData?.venue?.name}
              />
            )}
            {activeTab === 'Customers' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-6 shadow-sm">
                <CustomerSearchTab />
              </div>
            )}
            {activeTab === 'Settings' && !isSupervisor && <SettingsTab />}
            {activeTab === 'Locations' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-6 shadow-sm">
                <LocationsTab readOnly={isSupervisor} />
              </div>
            )}
            {activeTab === 'Live Feed' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-6 shadow-sm">
                <LiveFeedWidget />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}