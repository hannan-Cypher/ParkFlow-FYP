'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Target, Eye, Award, Users, Zap, Heart } from 'lucide-react'

export default function AboutPage() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const values = [
    {
      icon: Zap,
      title: 'Innovation',
      description: 'Pushing boundaries with AI technology',
    },
    {
      icon: Heart,
      title: 'Customer First',
      description: 'Your satisfaction is our priority',
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'Delivering world-class service quality',
    },
    {
      icon: Users,
      title: 'Teamwork',
      description: 'Collaboration drives our success',
    },
  ]

  const team = [
    {
      name: 'Muhammad Hannan Mohsin',
      role: 'Co-Founder & AI Lead',
      sap: '44646',
      emoji: '👨‍💻',
    },
    {
      name: 'Hafiz Sarmad Tahir',
      role: 'Co-Founder & UX Lead',
      sap: '46040',
      emoji: '👨‍💼',
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
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-6">
              About <span className="text-accent-400">Us</span>
            </h1>
            <p className="text-xl text-white/90">
              Revolutionizing valet parking through artificial intelligence and innovation
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-6">
                Our <span className="gradient-text">Story</span>
              </h2>
            </div>
            
            <div className="prose prose-lg max-w-none text-dark-700 space-y-6">
              <p className="text-xl leading-relaxed">
                We witnessed firsthand the frustrations of traditional valet parking: long wait times, 
                lost tokens, security concerns, and inefficient operations. We knew there had to be a better way.
              </p>
              <p className="text-xl leading-relaxed">
                Founded at Riphah International University, our team combines expertise in artificial intelligence, 
                computer vision, and user experience design. We've created an AI-powered valet parking management 
                system that eliminates friction and delivers a seamless experience for both venues and customers.
              </p>
              <p className="text-xl leading-relaxed">
                Our solution uses cutting-edge license plate recognition, smart slot allocation, and real-time 
                monitoring to transform valet parking into a premium, trustworthy service. We're not just improving 
                parking—we're reimagining it.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="section-padding bg-gradient-to-br from-gray-50 to-white">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white p-10 rounded-3xl shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-display font-bold text-dark-900 mb-4">
                Our Mission
              </h3>
              <p className="text-lg text-dark-700 leading-relaxed">
                To revolutionize valet parking through AI innovation, delivering efficient, 
                secure, and transparent solutions that enhance customer experience and operational excellence.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white p-10 rounded-3xl shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center mb-6">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-display font-bold text-dark-900 mb-4">
                Our Vision
              </h3>
              <p className="text-lg text-dark-700 leading-relaxed">
                To become the global standard for intelligent parking management, powering smart cities 
                and enabling seamless mobility experiences worldwide.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              Our <span className="gradient-text">Values</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className="text-center p-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center mb-6">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-3">{value.title}</h3>
                <p className="text-dark-600">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-padding bg-gradient-to-br from-gray-50 to-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              Meet Our <span className="gradient-text">Team</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              The innovators behind AI Valet Parking
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className="bg-white p-8 rounded-3xl shadow-xl text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="text-8xl mb-6"
                >
                  {member.emoji}
                </motion.div>
                <h3 className="text-2xl font-bold text-dark-900 mb-2">{member.name}</h3>
                <p className="text-primary-600 font-semibold mb-1">{member.role}</p>
                <p className="text-dark-600">SAP ID: {member.sap}</p>
                <p className="text-sm text-dark-500 mt-4">Riphah International University</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Supervisor Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <h3 className="text-3xl font-display font-bold text-dark-900 mb-4">
              Supervised By
            </h3>
            <div className="bg-gradient-to-br from-primary-50 to-accent-50 p-8 rounded-3xl">
              <div className="text-6xl mb-4">👨‍🏫</div>
              <h4 className="text-2xl font-bold text-dark-900 mb-2">Sir Zeeshan Ali</h4>
              <p className="text-primary-600 font-semibold">Lecturer</p>
              <p className="text-dark-600 mt-2">Faculty of Computing, Riphah International University</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
