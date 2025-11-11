'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Mall Manager',
      company: 'Centaurus Mall',
      image: '👩‍💼',
      rating: 5,
      text: 'The AI-powered valet system has transformed our customer experience. Wait times reduced by 70% and our customers love the live monitoring feature!',
    },
    {
      name: 'Michael Chen',
      role: 'Operations Director',
      company: 'Pearl Continental Hotel',
      image: '👨‍💼',
      rating: 5,
      text: 'Implementing this system was seamless. The license plate recognition is incredibly accurate, and our guests appreciate the frictionless experience.',
    },
    {
      name: 'Emily Rodriguez',
      role: 'Event Coordinator',
      company: 'Grand Events Venue',
      image: '👩',
      rating: 5,
      text: 'For large events, this system is a game-changer. We can handle 500+ vehicles efficiently without any chaos. Highly recommended!',
    },
    {
      name: 'David Thompson',
      role: 'Frequent User',
      company: 'Customer',
      image: '👨',
      rating: 5,
      text: 'As a customer, I love being able to track my car in real-time. The QR code pickup is so convenient, and I even got my car cleaned while shopping!',
    },
  ]

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

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
              <Star className="w-4 h-4" />
              <span className="text-sm font-semibold">Testimonials</span>
            </motion.div>
            
            <h2 className="text-4xl md:text-5xl font-display font-bold text-dark-900 mb-4">
              What Our <span className="gradient-text">Clients Say</span>
            </h2>
            <p className="text-xl text-dark-600 max-w-2xl mx-auto">
              Real experiences from real people who've transformed their parking operations
            </p>
          </div>

          {/* Testimonial Carousel */}
          <div className="relative max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-3xl p-8 md:p-12 shadow-xl">
                  {/* Quote Icon */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute top-8 right-8 text-primary-500/20"
                  >
                    <Quote className="w-20 h-20" />
                  </motion.div>

                  <div className="relative z-10">
                    {/* Rating */}
                    <div className="flex space-x-1 mb-6">
                      {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: i * 0.1, duration: 0.3 }}
                        >
                          <Star className="w-6 h-6 fill-accent-500 text-accent-500" />
                        </motion.div>
                      ))}
                    </div>

                    {/* Testimonial Text */}
                    <p className="text-xl md:text-2xl text-dark-800 mb-8 leading-relaxed">
                      "{testimonials[currentIndex].text}"
                    </p>

                    {/* Author Info */}
                    <div className="flex items-center space-x-4">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="text-6xl"
                      >
                        {testimonials[currentIndex].image}
                      </motion.div>
                      <div>
                        <div className="font-bold text-dark-900 text-lg">
                          {testimonials[currentIndex].name}
                        </div>
                        <div className="text-dark-600">
                          {testimonials[currentIndex].role} • {testimonials[currentIndex].company}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-center items-center space-x-4 mt-8">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={prevTestimonial}
                className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </motion.button>

              {/* Dots */}
              <div className="flex space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`transition-all duration-300 rounded-full ${
                      index === currentIndex
                        ? 'w-8 h-3 bg-primary-500'
                        : 'w-3 h-3 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={nextTestimonial}
                className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
