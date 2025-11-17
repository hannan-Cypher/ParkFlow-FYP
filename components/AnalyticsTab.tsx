'use client'

import { motion } from 'framer-motion'
import { DollarSign, Car, Users, Clock, Star } from 'lucide-react'

export default function AnalyticsTab() {
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

  const metrics = [
    {
      icon: DollarSign,
      label: 'Total Revenue',
      value: '$12,450',
      change: '+12.5%',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Car,
      label: 'Active Vehicles',
      value: '24',
      change: '+3',
      color: 'from-teal-500 to-green-500',
    },
    {
      icon: Users,
      label: 'Daily Customers',
      value: '156',
      change: '+8.2%',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Clock,
      label: 'Avg. Duration',
      value: '2.3h',
      change: '-5%',
      color: 'from-orange-500 to-red-500',
    },
  ]

  const peakHours = [
    { time: '10:00 - 11:00 AM', vehicles: 34, percentage: 100 },
    { time: '2:00 - 3:00 PM', vehicles: 31, percentage: 91 },
    { time: '6:00 - 7:00 PM', vehicles: 37, percentage: 109 },
  ]

  const satisfactionRatings = [
    { stars: 5, percentage: 75 },
    { stars: 4, percentage: 20 },
    { stars: 3, percentage: 3 },
    { stars: 2, percentage: 1 },
    { stars: 1, percentage: 1 },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Metrics Cards */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {metrics.map((metric, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 relative overflow-hidden"
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-5`} />

            {/* Content */}
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center`}
                >
                  <metric.icon className="w-6 h-6 text-white" />
                </motion.div>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  className="text-sm font-semibold px-3 py-1 bg-teal-100 text-teal-700 rounded-full"
                >
                  {metric.change}
                </motion.span>
              </div>
              <p className="text-gray-600 text-sm mb-1">{metric.label}</p>
              <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Peak Hours and Customer Satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours Analysis */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Peak Hours Analysis</h2>

          <div className="space-y-6">
            {peakHours.map((hour, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-medium">{hour.time}</span>
                  <span className="text-gray-600">{hour.vehicles} vehicles</span>
                </div>
                <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${hour.percentage}%` }}
                    transition={{ delay: index * 0.1 + 0.5, duration: 0.8, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Customer Satisfaction */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Satisfaction</h2>

          {/* Overall Rating */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="text-6xl font-bold text-teal-500 mb-2"
            >
              4.8
            </motion.div>
            <div className="flex items-center justify-center space-x-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.div
                  key={star}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: star * 0.1 + 0.3 }}
                >
                  <Star className="w-6 h-6 text-teal-500 fill-current" />
                </motion.div>
              ))}
            </div>
            <p className="text-gray-600">Based on 1,234 reviews</p>
          </div>

          {/* Rating Breakdown */}
          <div className="space-y-3">
            {satisfactionRatings.map((rating, index) => (
              <motion.div
                key={rating.stars}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.5 }}
                className="flex items-center space-x-3"
              >
                <div className="flex items-center space-x-1 w-12">
                  <span className="text-sm font-medium text-gray-700">{rating.stars}</span>
                  <Star className="w-3 h-3 text-gray-400" />
                </div>
                <div className="flex-1 relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${rating.percentage}%` }}
                    transition={{ delay: index * 0.1 + 0.7, duration: 0.6, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                  />
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">{rating.percentage}%</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
