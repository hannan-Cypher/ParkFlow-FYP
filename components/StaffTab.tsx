'use client'

import { motion } from 'framer-motion'

export default function StaffTab() {
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

  const staff = [
    {
      initials: 'JS',
      name: 'John Smith',
      id: 'VLT-001',
      status: 'On Duty',
      tasks: 32,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      initials: 'ED',
      name: 'Emma Davis',
      id: 'VLT-002',
      status: 'On Duty',
      tasks: 28,
      color: 'from-teal-500 to-green-500',
    },
    {
      initials: 'MB',
      name: 'Michael Brown',
      id: 'VLT-003',
      status: 'On Break',
      tasks: 25,
      color: 'from-purple-500 to-pink-500',
    },
    {
      initials: 'SW',
      name: 'Sarah Wilson',
      id: 'VLT-004',
      status: 'Off Duty',
      tasks: 0,
      color: 'from-orange-500 to-red-500',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On Duty':
        return 'bg-teal-500'
      case 'On Break':
        return 'bg-orange-500'
      case 'Off Duty':
        return 'bg-gray-400'
      default:
        return 'bg-gray-400'
    }
  }

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Staff Management</h2>

        <div className="space-y-4">
          {staff.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{ x: 5, scale: 1.01 }}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all cursor-pointer border border-gray-100"
            >
              {/* Left Side - Avatar and Info */}
              <div className="flex items-center space-x-4">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className={`w-14 h-14 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                >
                  {member.initials}
                </motion.div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.id}</p>
                </div>
              </div>

              {/* Right Side - Status and Tasks */}
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {member.tasks} tasks today
                  </p>
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`px-4 py-2 ${getStatusColor(member.status)} text-white rounded-lg font-semibold shadow-md`}
                >
                  {member.status}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
