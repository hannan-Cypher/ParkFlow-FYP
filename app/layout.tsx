import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

export const metadata: Metadata = {
  title: 'AI-Powered Valet Parking | Frictionless Management System',
  description: 'Experience the future of valet parking with AI-powered license plate recognition, smart slot allocation, and real-time monitoring.',
  keywords: 'valet parking, AI parking, smart parking, automated valet, parking management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}