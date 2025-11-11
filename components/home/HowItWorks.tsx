'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { LogIn, Scan, ParkingSquare, Smartphone, ArrowRight } from 'lucide-react'

export default function HowItWorks() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const steps = [
    {
      icon: LogIn,
      title: 'Arrive & Drop-Off',
      description: 'Simply drive up to our valet station and hand over your keys to our professional staff.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Scan,
      title: 'AI Recognition',
      description: 'Our AI-powered cameras instantly scan and recognize your license plate with 99.7% accuracy.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: ParkingSquare,
      title: 'Smart Parking',
      description: 'AI algorithms allocate the optimal parking spot and our valets park your vehicle securely.',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Smartphone,
      title: 'Track & Retrieve',
      description: 'Monitor your car via live feed and request retrieval through app, SMS, or QR code.',
      color: 'from-green-500 to-teal-500',
    },
  ]

  return (
    <section className="section-padding bg-gradient-to-b from-gray-50 to-white">
      <div className="container-custom">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={inView ? { scale: 1 } : { scale: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 bg-primary-100 text-primary-600 px-4 py-2 rounded-full mb-4"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="text-sm font-semibold">Process</span>
            </motion.div>
            
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              Four simple steps to experience the future of valet parking
            </p>
          </motion.div>

          {/* Steps */}
          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 via-orange-500 to-green-500 opacity-20" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: index * 0.2, duration: 0.6 }}
                  className="relative"
                >
                  {/* Step Number */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={inView ? { scale: 1 } : {}}
                    transition={{ delay: index * 0.2 + 0.3, duration: 0.5 }}
                    className="absolute -top-4 -right-4 z-10"
                  >
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                      {index + 1}
                    </div>
                  </motion.div>

                  {/* Card */}
                  <motion.div
                    whileHover={{ y: -10 }}
                    className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 h-full group"
                  >
                    {/* Gradient Background on Hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />
                    
                    {/* Icon */}
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                      className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-lg`}
                    >
                      <step.icon className="w-8 h-8 text-white" />
                    </motion.div>

                    {/* Content */}
                    <h3 className="text-xl font-bold text-dark-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-dark-600 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Arrow Indicator (except last) */}
                    {index < steps.length - 1 && (
                      <motion.div
                        initial={{ x: -10, opacity: 0 }}
                        animate={inView ? { x: 0, opacity: 1 } : {}}
                        transition={{ delay: index * 0.2 + 0.5 }}
                        className="hidden lg:block absolute -right-4 top-1/2 transform -translate-y-1/2 z-20"
                      >
                        <ArrowRight className={`w-8 h-8 text-transparent bg-gradient-to-r ${step.color} bg-clip-text`} />
                      </motion.div>
                    )}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 1, duration: 0.6 }}
            className="text-center mt-16"
          >
            <p className="text-lg text-dark-600 mb-6">
              Ready to experience effortless parking?
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary"
            >
              Get Started Today
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
