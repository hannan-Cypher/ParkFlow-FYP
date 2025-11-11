'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Building2, Hotel, Plane, ShoppingBag, PartyPopper, Check } from 'lucide-react'
import Link from 'next/link'

export default function Services() {
  const [activeTab, setActiveTab] = useState(0)
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const services = [
    {
      icon: Building2,
      title: 'Shopping Malls',
      description: 'Transform shopping experiences with hassle-free parking',
      features: [
        'Peak hour management',
        'Customer loyalty integration',
        'Real-time space monitoring',
        'Premium shopper services',
      ],
      image: '🏢',
    },
    {
      icon: Hotel,
      title: 'Hotels & Resorts',
      description: 'Luxury valet services for hospitality excellence',
      features: [
        '24/7 concierge service',
        'VIP guest prioritization',
        'Luggage assistance',
        'Vehicle detailing option',
      ],
      image: '🏨',
    },
    {
      icon: Plane,
      title: 'Airports',
      description: 'Efficient parking solutions for travelers',
      features: [
        'Long-term parking',
        'Flight-synced retrieval',
        'Shuttle coordination',
        'Security protocols',
      ],
      image: '✈️',
    },
    {
      icon: PartyPopper,
      title: 'Events & Venues',
      description: 'Scalable valet for any event size',
      features: [
        'Wedding & corporate events',
        'Temporary setup capability',
        'High-volume management',
        'Custom branding options',
      ],
      image: '🎉',
    },
  ]

  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Section Header */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ scale: 0 }}
              animate={inView ? { scale: 1 } : { scale: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 bg-accent-100 text-accent-600 px-4 py-2 rounded-full mb-4"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="text-sm font-semibold">Services</span>
            </motion.div>
            
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              Tailored for Every <span className="gradient-text">Venue</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              From bustling malls to exclusive events, our AI-powered system adapts to your unique needs
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {services.map((service, index) => (
              <motion.button
                key={index}
                onClick={() => setActiveTab(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === index
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'bg-gray-100 text-dark-700 hover:bg-gray-200'
                }`}
              >
                <service.icon className="w-5 h-5" />
                <span>{service.title}</span>
              </motion.button>
            ))}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 md:p-12 shadow-xl"
            >
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Left Side - Image */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  <div className="text-[200px] md:text-[250px] leading-none select-none">
                    {services[activeTab].image}
                  </div>
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      rotate: [0, 5, 0],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-3xl blur-3xl -z-10"
                  />
                </motion.div>

                {/* Right Side - Content */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-3xl font-display font-bold text-dark-900 mb-3">
                      {services[activeTab].title}
                    </h3>
                    <p className="text-lg text-dark-600">
                      {services[activeTab].description}
                    </p>
                  </div>

                  <ul className="space-y-4">
                    {services[activeTab].features.map((feature, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center space-x-3"
                      >
                        <div className="flex-shrink-0 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-dark-700">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>

                  <Link href="/services">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="btn-primary mt-4"
                    >
                      Learn More
                    </motion.button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
