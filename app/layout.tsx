import './globals.css'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { headers } from 'next/headers'

export const metadata = {
  title: 'AI-Powered Valet Parking | Frictionless Management System',
  description: 'Experience the future of valet parking with AI-powered license plate recognition, smart slot allocation, and real-time monitoring.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  const path = headersList.get('x-invoke-path') || ''
  const isDashboard = path.startsWith('/dashboard')

  return (
    <html lang="en" className="scroll-smooth">
      <body>
        {!isDashboard && <Navbar />}
        <main className={!isDashboard ? "min-h-screen" : ""}>
          {children}
        </main>
        {!isDashboard && <Footer />}
      </body>
    </html>
  )
}