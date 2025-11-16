"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  CheckCircle2,
  Clock,
  Users,
  Activity,
  MapPin,
  AlertCircle,
  TrendingUp,
  Package,
  Zap,
} from "lucide-react";

// Animation presets matching customer dashboard
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 12, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 220, damping: 22 } },
};

const subtleHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01 },
};

const tabs = ["Active Vehicles", "Tasks", "Performance"] as const;

type TabKey = typeof tabs[number];

export default function StaffDashboardPage() {
  const [activeTab, setActiveTab] = React.useState<TabKey>("Active Vehicles");

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <main className="mx-auto max-w-6xl px-4 pb-24 pt-10" />;
  }

  return (
    <motion.main
      className="mx-auto max-w-6xl px-4 pb-24 pt-10 text-slate-800"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.header variants={item} className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Staff Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back, Valet Attendant</p>
      </motion.header>

      {/* Real-time Stats */}
      <motion.section variants={item} className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={Car}
          label="Active Vehicles"
          value="24"
          subtext="Currently parked"
          color="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Avg. Duration"
          value="2h 45m"
          subtext="Average time"
          color="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Tasks Today"
          value="18"
          subtext="Completed"
          color="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={AlertCircle}
          label="Pending"
          value="2"
          subtext="Requires attention"
          color="bg-red-50"
          iconColor="text-red-600"
        />
      </motion.section>

      {/* Current Status Card */}
      <motion.section variants={item} className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <StatusPill label="On Duty" />
          <span className="text-sm font-medium text-slate-500">Your Shift</span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Shift Info */}
          <div className="col-span-1 md:col-span-7 grid grid-cols-3 gap-4 rounded-2xl border border-slate-200 p-4">
            <InfoRow icon={Clock} label="Shift Start" value="9:00 AM" />
            <InfoRow icon={TrendingUp} label="Tasks Handled" value="18" />
            <InfoRow icon={Users} label="Vehicles Served" value="24" />
          </div>

          {/* Quick Actions */}
          <div className="col-span-1 md:col-span-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="mb-3 text-base font-semibold">Quick Actions</h3>
              <div className="grid gap-2">
                <QuickAction 
                  icon={Car} 
                  label="Check-in Vehicle" 
                  intent="primary" 
                  onClick={() => alert("Check-in vehicle")} 
                />
                <QuickAction 
                  icon={MapPin} 
                  label="View Parking Map" 
                  onClick={() => setActiveTab("Active Vehicles")} 
                />
                <QuickAction 
                  icon={Package} 
                  label="Request Service" 
                  onClick={() => alert("Service request")} 
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Tabs */}
      <motion.nav variants={item} className="mt-6">
        <div className="relative flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`relative w-full rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === t ? "bg-white shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </motion.nav>

      {/* Content */}
      <section className="mt-4">
        <AnimatePresence mode="wait">
          {activeTab === "Active Vehicles" && (
            <motion.div
              key="vehicles"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <h4 className="mb-3 text-sm font-semibold text-slate-600">Currently Parked Vehicles</h4>
              <div className="space-y-3">
                {VEHICLES.map((v, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
                    variants={subtleHover}
                    initial="rest"
                    whileHover="hover"
                    animate="rest"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                        <Car className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <div className="font-medium">{v.plate}</div>
                        <div className="text-xs text-slate-500">{v.owner} • {v.entryTime}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <MapPin className="h-3 w-3" />
                          {v.slot}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{v.duration}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "Tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <h4 className="mb-3 text-sm font-semibold text-slate-600">Pending Tasks</h4>
              <div className="space-y-3">
                {TASKS.map((task, i) => (
                  <motion.div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                    variants={subtleHover}
                    initial="rest"
                    whileHover="hover"
                    animate="rest"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl ${task.bgColor}`}>
                          <task.icon className={`h-5 w-5 ${task.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-base font-semibold">{task.title}</div>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              task.priority === "High" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{task.desc}</p>
                          <p className="mt-1 text-xs text-slate-400">{task.time}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => alert(`Starting task: ${task.title}`)}
                        className="shrink-0 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                      >
                        Start
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "Performance" && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <h4 className="mb-3 text-sm font-semibold text-slate-600">Your Performance</h4>
              
              <div className="space-y-4">
                {/* Weekly Stats */}
                <div className="grid grid-cols-2 gap-4">
                  {PERFORMANCE_METRICS.map((metric, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm text-slate-500">{metric.label}</div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <div className="text-3xl font-bold tracking-tight">{metric.value}</div>
                        <span className={`text-sm font-medium ${metric.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                          {metric.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Achievement Card */}
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-blue-50 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 shadow-lg">
                      <TrendingUp className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">Excellent Performance!</div>
                      <div className="text-sm text-slate-600">You're in the top 10% this week</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.main>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color, iconColor }: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  color: string;
  iconColor: string;
}) {
  return (
    <motion.div
      variants={subtleHover}
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
          <div className="text-xs text-slate-500">{subtext}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span className="font-semibold tracking-wide text-slate-900">{value}</span>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  intent = "neutral",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  intent?: "primary" | "neutral";
  onClick?: () => void;
}) {
  return (
    <motion.button
      variants={subtleHover}
      initial="rest"
      whileHover="hover"
      whileTap={{ scale: 0.995 }}
      animate="rest"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-sm font-medium transition ${
        intent === "primary"
          ? "border-sky-600 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </motion.button>
  );
}

// Mock Data
const VEHICLES = [
  { plate: "ABC-123", owner: "Ahmed Khan", entryTime: "10:30 AM", duration: "2h 15m", slot: "A-12" },
  { plate: "XYZ-789", owner: "Fatima Ali", entryTime: "11:45 AM", duration: "1h 30m", slot: "B-05" },
  { plate: "DEF-456", owner: "Muhammad Hassan", entryTime: "09:15 AM", duration: "4h 45m", slot: "C-18" },
  { plate: "GHI-012", owner: "Sara Ahmed", entryTime: "12:00 PM", duration: "45m", slot: "A-08" },
];

const TASKS = [
  { 
    icon: Car, 
    title: "Retrieve Vehicle ABC-123", 
    desc: "Customer request for vehicle retrieval", 
    priority: "High", 
    time: "2 min ago",
    color: "text-red-600",
    bgColor: "bg-red-50"
  },
  { 
    icon: Activity, 
    title: "Parking Slot Maintenance", 
    desc: "Clean and inspect slot B-12", 
    priority: "Medium", 
    time: "15 min ago",
    color: "text-amber-600",
    bgColor: "bg-amber-50"
  },
  { 
    icon: AlertCircle, 
    title: "Handle Customer Inquiry", 
    desc: "Customer reporting vehicle location issue", 
    priority: "High", 
    time: "5 min ago",
    color: "text-red-600",
    bgColor: "bg-red-50"
  },
];

const PERFORMANCE_METRICS = [
  { label: "Total Tasks This Week", value: "108", trend: "+5%" },
  { label: "Avg. Time per Task", value: "12m", trend: "-2%" },
  { label: "Customer Satisfaction", value: "4.8", trend: "+0.2" },
  { label: "On-Time Rate", value: "96%", trend: "+3%" },
];
