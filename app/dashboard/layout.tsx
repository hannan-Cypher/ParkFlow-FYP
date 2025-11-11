import '../globals.css'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  )
}