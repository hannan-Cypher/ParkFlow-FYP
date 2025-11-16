'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import OverviewTab from '@/components/OverviewTab'
import AnalyticsTab from '@/components/AnalyticsTab'
import StaffTab from '@/components/StaffTab'
import SettingsTab from '@/components/SettingsTab'

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('Overview')

  const tabs = ['Overview', 'Analytics', 'Staff', 'Settings']

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container-custom py-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </motion.button>
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-gray-600">ParkFlow Management Console</p>
            </div>
          </div>

          {/* Live Indicator */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-500 text-white rounded-lg shadow-lg"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-white rounded-full"
            />
            <span className="font-semibold">Live</span>
          </motion.div>
        </motion.div>

        {/* Tabs Navigation */}
        <motion.div
          variants={itemVariants}
          className="flex space-x-2 mb-8 bg-white p-2 rounded-xl shadow-md"
        >
          {tabs.map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </motion.button>
          ))}
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
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
