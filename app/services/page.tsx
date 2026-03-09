'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { 
  Scan, Brain, Shield, Smartphone, Camera, Zap,
  Building2, Hotel, Plane, ShoppingBag, PartyPopper,
  Check, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export default function ServicesPage() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const coreServices = [
    {
      icon: Scan,
      title: 'AI License Plate Recognition',
      description: 'State-of-the-art ANPR technology powered by YOLOv8 for instant vehicle identification.',
      features: [
        '99.7% accuracy rate',
        'Works in all weather conditions',
        'Real-time processing',
        'Multi-camera support',
      ],
    },
    {
      icon: Brain,
      title: 'Smart Slot Allocation',
      description: 'AI algorithms optimize parking space utilization and minimize retrieval time.',
      features: [
        'Intelligent space optimization',
        'Predictive allocation',
        'Priority handling',
        'Dynamic reallocation',
      ],
    },
    {
      icon: Camera,
      title: 'Live Vehicle Monitoring',
      description: 'Real-time CCTV integration provides 24/7 surveillance and peace of mind.',
      features: [
        '24/7 live streaming',
        'Mobile app access',
        'Motion detection alerts',
        'Incident recording',
      ],
    },
    {
      icon: Smartphone,
      title: 'Mobile App Platform',
      description: 'User-friendly apps for both customers and valet staff with seamless experience.',
      features: [
        'QR code check-in/out',
        'Real-time tracking',
        'Service requests',
        'Digital receipts',
      ],
    },
    {
      icon: Shield,
      title: 'Advanced Security',
      description: 'Multi-layered security with digital verification and anomaly detection.',
      features: [
        'Encrypted communications',
        'Anomaly detection AI',
        'Access control logs',
        'Incident management',
      ],
    },
    {
      icon: Zap,
      title: 'Frictionless Access',
      description: 'Multiple access options including QR codes, SMS, and WhatsApp for all users.',
      features: [
        'App-based access',
        'SMS notifications',
        'WhatsApp integration',
        'QR code system',
      ],
    },
  ]

  const industries = [
    {
      icon: Building2,
      title: 'Shopping Malls',
      description: 'Enhanced customer experience with quick turnaround',
    },
    {
      icon: Hotel,
      title: 'Hotels & Resorts',
      description: 'Premium valet services for luxury hospitality',
    },
    {
      icon: Plane,
      title: 'Airports',
      description: 'Efficient solutions for high-volume traffic',
    },
    {
      icon: ShoppingBag,
      title: 'Retail Centers',
      description: 'Streamlined parking for commercial spaces',
    },
    {
      icon: PartyPopper,
      title: 'Event Venues',
      description: 'Scalable services for any event size',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 gradient-bg text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />
        </div>

        <div className="container-custom relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full mb-6"
            >
              <Zap className="w-5 h-5" />
              <span className="text-sm font-semibold">Our Services</span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl font-display font-bold mb-6">
              Comprehensive Valet <span className="text-accent-400">Solutions</span>
            </h1>
            <p className="text-xl mb-8 text-white/90">
              From AI-powered recognition to real-time monitoring, we provide everything you need for world-class valet parking
            </p>
          </motion.div>
        </div>
      </section>

      {/* Core Services */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
                Core <span className="gradient-text">Services</span>
              </h2>
              <p className="text-xl text-dark-600 max-w-2xl mx-auto">
                Powerful features designed to revolutionize your parking operations
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coreServices.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  whileHover={{ y: -10 }}
                  className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-gray-100"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-6">
                    <service.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-dark-900 mb-3">
                    {service.title}
                  </h3>
                  <p className="text-dark-600 mb-6">
                    {service.description}
                  </p>

                  <ul className="space-y-3">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center space-x-2">
                        <Check className="w-5 h-5 text-primary-500 flex-shrink-0" />
                        <span className="text-dark-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Industries */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              Industries We <span className="gradient-text">Serve</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              Trusted by leading venues across multiple industries
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {industries.map((industry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all text-center"
              >
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center mb-4">
                  <industry.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-bold text-dark-900 mb-2">{industry.title}</h3>
                <p className="text-sm text-dark-600">{industry.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding gradient-bg text-white">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Transform your parking operations with our AI-powered solution
            </p>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary bg-white text-primary-500 hover:bg-gray-100 inline-flex items-center space-x-2"
              >
                <span>Contact Us Today</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
