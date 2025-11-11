"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react";

// Animation presets
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

const tabs = ["Parking History", "Services", "Payment"] as const;

type TabKey = typeof tabs[number];

export default function CustomerDashboardPage() {
  const [activeTab, setActiveTab] = React.useState<TabKey>("Parking History");

  // Prevent hydration mismatches by rendering only after mount
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    // Render a minimal shell that matches on both server & first client paint
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
        <h1 className="text-2xl font-semibold tracking-tight">Customer Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back</p>
      </motion.header>

      {/* Current Parking / Quick Actions */}
      <motion.section variants={item} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <StatusPill label="Active" />
          <span className="text-sm font-medium text-slate-500">Current Parking</span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Vehicle card */}
          <motion.div variants={item} className="relative col-span-1 overflow-hidden rounded-2xl border border-slate-200 md:col-span-7">
            <div className="relative h-48 w-full md:h-56">
              {/* Plain <img> so missing file won't crash dev */}
              <img
                src="/car-hero.jpg"
                alt="Current vehicle"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            </div>

            <div className="grid grid-cols-3 gap-2 p-4 text-sm md:grid-cols-3">
              <InfoRow icon={Car} label="License Plate" value="ABC-1234" />
              <InfoRow icon={MapPin} label="Parking Slot" value="A-12" />
              <InfoRow icon={Clock} label="Check-in Time" value="10:30 AM" />
            </div>
          </motion.div>

          {/* Quick actions + stats */}
          <motion.div variants={item} className="col-span-1 md:col-span-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="mb-3 text-base font-semibold">Quick Actions</h3>
              <div className="grid gap-2">
                <QuickAction icon={Car} label="Request Vehicle Retrieval" intent="primary" onClick={() => alert("Retrieval requested")} />
                <QuickAction icon={Sparkles} label="Book Cleaning Service" onClick={() => setActiveTab("Services")} />
                <QuickAction icon={Navigation} label="View Live Location" onClick={() => alert("Opening live location…")} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <StatBox label="Current Duration" value="2h 15m" align="right" />
                <StatBox label="Estimated Cost" value="Rs.145" align="right" />
              </div>
            </div>
          </motion.div>
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
          {activeTab === "Parking History" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <h4 className="mb-3 text-sm font-semibold text-slate-600">Recent Parking Sessions</h4>
              <div className="space-y-3">
                {HISTORY.map((s, i) => (
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
                        <History className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{s.place}</div>
                        <div className="text-xs text-slate-500">{s.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{s.price}</div>
                      <div className="text-xs text-slate-500">{s.duration}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "Services" && (
            <motion.div
              key="services"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <h4 className="mb-3 text-sm font-semibold text-slate-600">Available Services</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {SERVICES.map((svc, i) => (
                  <motion.div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                    variants={subtleHover}
                    initial="rest"
                    whileHover="hover"
                    animate="rest"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                          <svc.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{svc.title}</div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{svc.desc}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-lg font-bold">{svc.price}</div>
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={() => alert(`Booked: ${svc.title}`)}
                        className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Book Now
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "Payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <h4 className="sr-only">Payment Methods</h4>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">Visa •••• 4242</div>
                      <div className="text-xs text-slate-500">Expires 12/25</div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Default
                  </span>
                </div>

                <button
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => alert("Add new payment method")}
                >
                  <Plus className="h-4 w-4" /> Add Payment Method
                </button>
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

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/70 p-2 text-slate-700">
      <Icon className="h-4 w-4 text-slate-500" />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="ml-auto font-semibold tracking-wide text-slate-900">{value}</span>
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
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ${
        intent === "primary"
          ? "border-sky-600 bg-sky-600 text-white shadow-sm hover:bg-sky-700 focus-visible:ring-sky-500"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </motion.button>
  );
}

function StatBox({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={`rounded-lg bg-white p-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

// --- Mock Data ---
const HISTORY = [
  { place: "Mall Plaza", date: "Sep 15, 2025", price: "Rs.150", duration: "2h 30m" },
  { place: "Airport", date: "Sep 10, 2025", price: "Rs.120", duration: "1h 45m" },
  { place: "Hotel Grand", date: "Sep 5, 2025", price: "Rs.180", duration: "3h 15m" },
];

const SERVICES = [
  { icon: Sparkles, title: "Express Cleaning", desc: "Quick exterior wash and interior vacuum", price: "Rs.250" },
  { icon: Wand2, title: "Premium Detail", desc: "Complete interior & exterior detailing", price: "Rs.750" },
];
