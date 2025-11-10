'use client'

import { motion } from 'framer-motion'
import Hero from '@/components/home/Hero'
import Features from '@/components/home/Features'
import Services from '@/components/home/Services'
import HowItWorks from '@/components/home/HowItWorks'
import Stats from '@/components/home/Stats'
import Testimonials from '@/components/home/Testimonials'
import Partners from '@/components/home/Partners'
import CTA from '@/components/home/CTA'

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Services />
      <HowItWorks />
      <Stats />
      <Testimonials />
      <Partners />
      <CTA />
    </>
  )
}
