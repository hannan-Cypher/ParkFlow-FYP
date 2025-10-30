"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Car, 
  Zap, 
  Shield, 
  Clock, 
  Camera,
  BarChart3,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Star,
  Users,
  Building2
} from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold">ParkFlow</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <Link href="#features" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium hover:text-blue-600 transition-colors">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-200">
              <Zap className="h-3 w-3 mr-1" />
              AI-Powered Technology
            </Badge>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Valet Parking
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Eliminate paper tickets and reduce wait times with intelligent license plate 
              recognition. Professional valet management for modern venues.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#demo">Watch Demo</Link>
              </Button>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>14-day free trial</span>
              </div>
            </div>
          </div>
          
          {/* Dashboard Preview */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Car className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">LEA-1212</div>
                    <div className="text-sm text-slate-600">Slot A-15</div>
                  </div>
                </div>
                <Badge className="bg-green-500">Active</Badge>
              </div>
              {[
                { plate: "ABC-5678", slot: "B-22" },
                { plate: "XYZ-9101", slot: "C-08" },
                { plate: "MNO-3456", slot: "A-31" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-slate-200 rounded-lg flex items-center justify-center">
                      <Car className="h-6 w-6 text-slate-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">{item.plate}</div>
                      <div className="text-sm text-slate-500">{item.slot}</div>
                    </div>
                  </div>
                  <Badge variant="outline">Parked</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-blue-600 to-cyan-600 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <div className="text-4xl font-bold mb-2">50K+</div>
              <div className="text-blue-100">Vehicles Parked</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">99.5%</div>
              <div className="text-blue-100">AI Accuracy</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">70%</div>
              <div className="text-blue-100">Time Saved</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">150+</div>
              <div className="text-blue-100">Active Venues</div>
            </div>
          </div>
        </div>
      </section>


      {/* Features Section */}
<section id="features" className="container mx-auto px-4 py-20">
  <div className="text-center mb-16">
    <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
      Everything you need for modern valet parking management
    </p>
  </div>
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
    {[
      {
        icon: Camera,
        title: "AI License Plate Recognition",
        description: "Instant vehicle identification with 99.5% accuracy using computer vision",
        color: "blue"
      },
      {
        icon: Zap,
        title: "Fast Check-in/Check-out",
        description: "Reduce average processing time from 3 minutes to 20 seconds",
        color: "cyan"
      },
      {
        icon: Shield,
        title: "Secure & Reliable",
        description: "Real-time tracking with digital verification and audit logs",
        color: "green"
      },
      {
        icon: Smartphone,
        title: "Mobile Dashboard",
        description: "Track vehicles and manage operations from any device",
        color: "purple"
      },
      {
        icon: BarChart3,
        title: "Analytics & Reports",
        description: "Detailed insights on parking patterns and revenue",
        color: "orange"
      },
      {
        icon: Users,
        title: "Multi-Tenant SaaS",
        description: "Perfect for malls, airports, hotels, and event venues",
        color: "pink"
      }
    ].map((feature, i) => (
      <Card 
        key={i} 
        className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border-2 hover:border-blue-300 relative overflow-hidden"
      >
        {/* Animated background gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardContent className="p-6 relative z-10">
          <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-blue-600">
            <feature.icon className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors duration-300" />
          </div>
          <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 transition-colors duration-300">
            {feature.title}
          </h3>
          <p className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300">
            {feature.description}
          </p>
          
          {/* Animated arrow that appears on hover */}
          <div className="mt-4 flex items-center text-blue-600 font-medium text-sm opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-2 transition-all duration-300">
            Learn more
            <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </CardContent>
        
        {/* Animated corner accent */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-10 rounded-bl-full transition-opacity duration-300" />
      </Card>
    ))}
  </div>
</section>
      {/* How It Works */}
      <section id="how-it-works" className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-slate-600">Simple process, powerful results</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Drive Up",
                description: "Customer arrives at valet entrance. No need to stop or provide any information."
              },
              {
                step: "2",
                title: "AI Scans Plate",
                description: "Our system automatically detects and reads the license plate in real-time."
              },
              {
                step: "3",
                title: "Park & Track",
                description: "Vehicle is parked and customer can track it anytime via their phone."
              }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Trusted by Leading Venues</h2>
          <p className="text-xl text-slate-600">See what our customers say</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Sarah Johnson",
              role: "Operations Manager",
              company: "Grand Mall",
              quote: "ParkFlow reduced our check-in times by 70%. Our customers love the seamless experience.",
              rating: 5
            },
            {
              name: "Michael Chen",
              role: "VP of Operations",
              company: "City Airport",
              quote: "Best investment we made this year. The ROI was evident within the first quarter.",
              rating: 5
            },
            {
              name: "Emily Rodriguez",
              role: "General Manager",
              company: "Luxury Hotel",
              quote: "The AI accuracy is incredible. We'll never go back to paper tickets.",
              rating: 5
            }
          ].map((testimonial, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{testimonial.name}</div>
                    <div className="text-xs text-slate-600">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-cyan-600 py-20">
        <div className="container mx-auto px-4 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join 150+ venues using ParkFlow. Start your free 14-day trial today.
          </p>
          <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100" asChild>
            <Link href="/signup">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Car className="h-6 w-6 text-blue-600" />
                <span className="text-xl font-bold">ParkFlow</span>
              </div>
              <p className="text-slate-600 text-sm">
                AI-Powered Valet Parking Management
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <div className="space-y-2 text-sm text-slate-600">
                <div><Link href="#features">Features</Link></div>
                <div><Link href="#pricing">Pricing</Link></div>
                <div><Link href="#demo">Demo</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <div className="space-y-2 text-sm text-slate-600">
                <div><Link href="#">About</Link></div>
                <div><Link href="#">Blog</Link></div>
                <div><Link href="#">Contact</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <div className="space-y-2 text-sm text-slate-600">
                <div><Link href="#">Privacy</Link></div>
                <div><Link href="#">Terms</Link></div>
                <div><Link href="#">Security</Link></div>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-slate-600 text-sm">
            <p>© 2025 ParkFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}