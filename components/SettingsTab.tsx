'use client'

import { motion } from 'framer-motion'
import { Brain, Camera, CreditCard } from 'lucide-react'

export default function SettingsTab() {
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

  const systemSettings = [
    {
      icon: Brain,
      title: 'AI Recognition System',
      description: 'License plate detection accuracy',
      status: '99.8% Active',
      statusColor: 'bg-teal-500',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Camera,
      title: 'CCTV Integration',
      description: 'Live monitoring and recording',
      status: 'Connected',
      statusColor: 'bg-teal-500',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: CreditCard,
      title: 'Payment Gateway',
      description: 'Secure transaction processing',
      status: 'Active',
      statusColor: 'bg-teal-500',
      color: 'from-green-500 to-teal-500',
    },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -5 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h2>

        <div className="space-y-4">
          {systemSettings.map((setting, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{ x: 5, scale: 1.01 }}
              className="flex items-center justify-between p-6 rounded-xl hover:bg-gray-50 transition-all cursor-pointer border border-gray-100"
            >
              {/* Left Side - Icon and Info */}
              <div className="flex items-center space-x-4">
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${setting.color} flex items-center justify-center shadow-lg`}
                >
                  <setting.icon className="w-7 h-7 text-white" />
                </motion.div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{setting.title}</p>
                  <p className="text-sm text-gray-500">{setting.description}</p>
                </div>
              </div>

              {/* Right Side - Status */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`px-6 py-2 ${setting.statusColor} text-white rounded-lg font-semibold shadow-md`}
              >
                {setting.status}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
