'use client'

import { motion } from 'framer-motion'
import { Activity, TrendingUp, Star, BarChart3 } from 'lucide-react'

export default function OverviewTab() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  }

  const activities = [
    { text: 'Vehicle ABC-1234 checked in', time: '10:45 AM' },
    { text: 'Payment received - $25.00', time: '10:30 AM' },
    { text: 'Valet VLT-003 clocked in', time: '10:15 AM' },
    { text: 'Cleaning service completed', time: '10:00 AM' },
    { text: 'Vehicle XYZ-9876 retrieved', time: '09:45 AM' },
  ]

  const topPerformers = [
    { id: 'VLT-001', name: 'Valet VLT-001', tasks: 32, rating: 4.9 },
    { id: 'VLT-005', name: 'Valet VLT-005', tasks: 28, rating: 4.8 },
    { id: 'VLT-003', name: 'Valet VLT-003', tasks: 25, rating: 4.7 },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Real-time Activity */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -5 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Real-time Activity</h2>
          <Activity className="w-6 h-6 text-teal-500" />
        </div>

        <div className="space-y-4">
          {activities.map((activity, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{ x: 5 }}
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"
              />
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{activity.text}</p>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Top Performers Today */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -5 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Top Performers Today</h2>
          <TrendingUp className="w-6 h-6 text-teal-500" />
        </div>

        <div className="space-y-4">
          {topPerformers.map((performer, index) => (
            <motion.div
              key={performer.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{ scale: 1.02 }}
              className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                  {index + 1}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{performer.name}</p>
                  <p className="text-sm text-gray-600">{performer.tasks} tasks completed</p>
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="flex items-center space-x-1 px-3 py-1 bg-teal-500 text-white rounded-full"
              >
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">{performer.rating}</span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Revenue Overview */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -5 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 lg:col-span-2"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Revenue Overview</h2>
          <BarChart3 className="w-6 h-6 text-teal-500" />
        </div>

        {/* Chart Placeholder */}
        <div className="h-64 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          >
            <BarChart3 className="w-20 h-20 text-gray-300 mb-4" />
          </motion.div>
          <p className="text-gray-500 font-medium">Chart visualization</p>
          <p className="text-gray-400 text-sm">Revenue trending upward by 12.5%</p>
        </div>
      </motion.div>
    </motion.div>
  )
}
