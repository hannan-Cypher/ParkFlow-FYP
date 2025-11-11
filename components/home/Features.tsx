'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Scan, Brain, Shield, Smartphone, Camera, Zap } from 'lucide-react'

export default function Features() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const features = [
    {
      icon: Scan,
      title: 'License Plate Recognition',
      description: 'Advanced AI-powered ANPR technology identifies vehicles instantly with 99.7% accuracy.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Brain,
      title: 'Smart Slot Allocation',
      description: 'AI algorithms optimize parking space utilization and reduce retrieval time.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Camera,
      title: 'Live Monitoring',
      description: 'Real-time CCTV integration allows customers to monitor their vehicles 24/7.',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Smartphone,
      title: 'Mobile App',
      description: 'Seamless app experience for vehicle check-in, tracking, and optional services.',
      color: 'from-green-500 to-teal-500',
    },
    {
      icon: Shield,
      title: 'Enhanced Security',
      description: 'Multi-layer security with digital verification and anomaly detection.',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      icon: Zap,
      title: 'Instant Access',
      description: 'Frictionless entry with QR codes or WhatsApp SMS for non-app users.',
      color: 'from-yellow-500 to-orange-500',
    },
  ]

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  }

  return (
    <section className="section-padding bg-gradient-to-b from-white to-gray-50">
      <div className="container-custom">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={containerVariants}
        >
          {/* Section Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <motion.div
              initial={{ scale: 0 }}
              animate={inView ? { scale: 1 } : { scale: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 bg-primary-100 text-primary-600 px-4 py-2 rounded-full mb-4"
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-semibold">Features</span>
            </motion.div>
            
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              Powered by <span className="gradient-text">AI Innovation</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              Experience cutting-edge technology that transforms traditional valet parking into a seamless, intelligent service
            </p>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -10 }}
                className="group relative"
              >
                <div className="relative p-8 bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 h-full border border-gray-100">
                  {/* Gradient Background on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />
                  
                  {/* Icon */}
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-dark-900 mb-3 group-hover:text-primary-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-dark-600 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Decorative Element */}
                  <motion.div
                    initial={{ width: 0 }}
                    whileHover={{ width: '100%' }}
                    className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${feature.color} rounded-b-2xl`}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
