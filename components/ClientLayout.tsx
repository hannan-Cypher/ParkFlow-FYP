'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    )
  }

  // Hide navbar and footer on dashboard routes
  const isDashboardRoute = pathname?.startsWith('/dashboard') || 
                          pathname?.startsWith('/admin') || 
                          pathname?.startsWith('/staff')

  if (isDashboardRoute) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  )
}