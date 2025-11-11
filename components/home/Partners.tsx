'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

export default function Partners() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  // Partner logos (using emoji for demonstration - replace with actual logo images)
  const partners = [
    { name: 'Centaurus Mall', logo: '🏢' },
    { name: 'Pearl Continental', logo: '🏨' },
    { name: 'Islamabad Airport', logo: '✈️' },
    { name: 'Serena Hotel', logo: '🏛️' },
    { name: 'Grand Hyatt', logo: '🌟' },
    { name: 'Dolmen Mall', logo: '🛍️' },
    { name: 'Marriott Hotel', logo: '🏩' },
    { name: 'Emporium Mall', logo: '🏬' },
  ]

  return (
    <section className="section-padding bg-gradient-to-b from-white to-gray-50">
      <div className="container-custom">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-dark-900 mb-4">
              Trusted by Leading <span className="gradient-text">Venues</span>
            </h2>
            <p className="text-lg text-dark-600 max-w-2xl mx-auto">
              We partner with some of the most prestigious venues across Pakistan
            </p>
          </div>

          {/* Partners Grid with Animation */}
          <div className="relative overflow-hidden">
            {/* First Row - Moving Right */}
            <motion.div
              animate={{
                x: [0, -1000],
              }}
              transition={{
                x: {
                  duration: 20,
                  repeat: Infinity,
                  ease: 'linear',
                },
              }}
              className="flex space-x-8 mb-8"
            >
              {[...partners, ...partners].map((partner, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.1, y: -5 }}
                  className="flex-shrink-0 w-48 h-32 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center p-6 border border-gray-100 group"
                >
                  <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">
                    {partner.logo}
                  </div>
                  <div className="text-sm font-semibold text-dark-700 text-center">
                    {partner.name}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Second Row - Moving Left */}
            <motion.div
              animate={{
                x: [-1000, 0],
              }}
              transition={{
                x: {
                  duration: 20,
                  repeat: Infinity,
                  ease: 'linear',
                },
              }}
              className="flex space-x-8"
            >
              {[...partners.reverse(), ...partners].map((partner, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.1, y: -5 }}
                  className="flex-shrink-0 w-48 h-32 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center p-6 border border-gray-100 group"
                >
                  <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">
                    {partner.logo}
                  </div>
                  <div className="text-sm font-semibold text-dark-700 text-center">
                    {partner.name}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Gradient Overlays */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
