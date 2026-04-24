"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Droplets,
  History,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Wand2,
  LogOut,
  User,
  Loader2,
  RefreshCw,
  Video,
  AlertCircle,
  Bell,
  ChevronRight,
  Banknote,
  ArrowDownLeft,
  Settings,
  Wifi,
  WifiOff,
  Star,
  Receipt,
  X,
  PartyPopper,
} from "lucide-react";
import DarkModeToggle from "@/components/DarkModeToggle";
import { useRealtime } from "@/hooks/useRealtime";
import { WebRTCViewer } from "@/components/admin/LiveFeedWidget";

// ── Animation Presets ───────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 12, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 220, damping: 22 },
  },
};

const subtleHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01 },
};

// ── Types ───────────────────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  status: string;
  entry_time: string;
  duration: string | null;
  rate_per_hour: number;
  total_hours: number | null;
  total_amount: number | null;
  retrieval_status: string | null;
  qr_code: string | null;
  vehicle: {
    id: string;
    license_plate: string;
    make: string | null;
    model: string | null;
    color: string | null;
    vehicle_type: string;
  };
  slot: {
    id: string;
    slot_number: string;
    floor_level: string | null;
    zone: string | null;
    slot_type: string;
  } | null;
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
  };
  staff_name: string | null;
  customer_name: string | null;
  gate_id: string | null;
}

interface CompletedSession {
  id: string;
  status: string;
  entry_time: string;
  exit_time: string | null;
  duration: string | null;
  total_amount: number | null;
  total_hours: number | null;
  rate_per_hour: number;
  payment_status: string;
  rating: number | null;
  rating_comment: string | null;
  vehicle: {
    license_plate: string;
    make: string | null;
    model: string | null;
    color: string | null;
    vehicle_type: string;
  };
  slot: { slot_number: string; floor_level: string | null } | null;
  venue: {
    name: string;
    city: string;
  };
}

interface WashRequest {
  id: string;
  session_id: string;
  wash_type: string;
  service_status: string;
  service_cost: number | null;
  notes: string | null;
  assigned_to_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  after_photos: string[];
  created_at: string;
}

// ── Tabs ────────────────────────────────────────────────────────────────────
const tabs = [
  "Parking History",
  "Live Feed",
  "Services",
  "Payment",
] as const;

type TabKey = (typeof tabs)[number];

// ── Main Component ──────────────────────────────────────────────────────────

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabKey>("Parking History");
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Real data states
  const [activeSessions, setActiveSessions] = React.useState<ActiveSession[]>(
    []
  );
  const [completedSessions, setCompletedSessions] = React.useState<
    CompletedSession[]
  >([]);
  const [loadingActive, setLoadingActive] = React.useState(true);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [retrievalLoading, setRetrievalLoading] = React.useState<string | null>(
    null
  );
  const [retrievalSuccess, setRetrievalSuccess] = React.useState<string | null>(
    null
  );

  // ── Checkout detection & receipt/rating ──────────────────────────────────
  const prevActiveIdsRef = React.useRef<Set<string>>(new Set());
  const [receiptSession, setReceiptSession] = React.useState<CompletedSession | null>(null);
  const [showRating, setShowRating] = React.useState(false);
  const [carArrivedAlert, setCarArrivedAlert] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // ── Fetch active sessions (with checkout detection) ──────────────────────
  const fetchActiveSessions = React.useCallback(async () => {
    try {
      setLoadingActive(true);
      const res = await fetch("/api/sessions?status=active");
      if (res.ok) {
        const data = await res.json();
        const newSessions: ActiveSession[] = data.sessions ?? [];
        const newIds = new Set(newSessions.map((s) => s.id));

        // Detect sessions that just became inactive (checked out)
        const removedIds = [...prevActiveIdsRef.current].filter((id) => !newIds.has(id));

        if (removedIds.length > 0 && prevActiveIdsRef.current.size > 0) {
          // Fetch completed sessions to find the receipt
          const completedRes = await fetch("/api/sessions?status=completed");
          if (completedRes.ok) {
            const completedData = await completedRes.json();
            const allCompleted: CompletedSession[] = completedData.sessions ?? [];
            setCompletedSessions(allCompleted);

            // Find the session that just completed and is unrated
            const justCompleted = allCompleted.find(
              (s) => removedIds.includes(s.id) && s.rating === null
            );
            if (justCompleted) {
              setReceiptSession(justCompleted);
              setCarArrivedAlert(true);
            }
          }
        }

        prevActiveIdsRef.current = newIds;
        setActiveSessions(newSessions);
      }
    } catch (err) {
      console.error("Failed to fetch active sessions:", err);
    } finally {
      setLoadingActive(false);
    }
  }, []);

  // ── Fetch completed sessions ──────────────────────────────────────────────
  const fetchCompletedSessions = React.useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch("/api/sessions?status=completed");
      if (res.ok) {
        const data = await res.json();
        setCompletedSessions(data.sessions ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch completed sessions:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    fetchActiveSessions();
    fetchCompletedSessions();
  }, [fetchActiveSessions, fetchCompletedSessions]);

  // Real-time updates via SSE
  useRealtime(React.useCallback((event) => {
    if (event.table === 'parking_sessions' || event.table === 'transactions' || event.table === 'service_requests') {
      fetchActiveSessions();
      fetchCompletedSessions();
    }
  }, [fetchActiveSessions, fetchCompletedSessions]), ['parking_sessions', 'transactions', 'service_requests']);

  // ── Request vehicle retrieval ─────────────────────────────────────────────
  const handleRetrieveVehicle = async (sessionId: string) => {
    setRetrievalLoading(sessionId);
    setRetrievalSuccess(null);
    try {
      const res = await fetch("/api/sessions/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRetrievalSuccess(sessionId);
        // Refresh to show updated retrieval status
        fetchActiveSessions();
      } else {
        alert(data.error || "Failed to request retrieval");
      }
    } catch (err) {
      console.error("Retrieval request failed:", err);
      alert("Failed to request retrieval. Please try again.");
    } finally {
      setRetrievalLoading(null);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!mounted) {
    return <main className="mx-auto max-w-6xl px-4 pb-24 pt-10" />;
  }

  // ── Computed data ─────────────────────────────────────────────────────────
  const currentSession =
    activeSessions.length > 0 ? activeSessions[0] : null;

  // Estimated cost for active session
  const estimatedCost = currentSession
    ? (() => {
      const ms =
        Date.now() - new Date(currentSession.entry_time).getTime();
      const hours = Math.max(Math.ceil(ms / 3600000), 1);
      return hours * currentSession.rate_per_hour;
    })()
    : 0;

  return (
    <motion.main
      className="mx-auto max-w-6xl px-4 pb-24 pt-6 text-slate-800 dark:text-slate-100 min-h-screen"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Dark Mode Background */}
      <div className="fixed inset-0 -z-10 bg-slate-50 dark:bg-slate-900 transition-colors duration-300" />
      {/* Header with User Info and Logout */}
      <motion.header
        variants={item}
        className="mb-5 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Customer
              </span>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight dark:text-white">
            Customer Dashboard
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Welcome back</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DarkModeToggle />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </motion.button>
        </div>
      </motion.header>

      {/* ── Current Active Parking Section ─────────────────────────────────── */}
      <motion.section
        variants={item}
        className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors duration-300"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentSession ? (
              <StatusPill label="Active" />
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                No Active Parking
              </span>
            )}
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Current Parking
            </span>
          </div>
          <button
            onClick={() => fetchActiveSessions()}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingActive ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {loadingActive && activeSessions.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          </div>
        ) : currentSession ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            {/* Vehicle card */}
            <motion.div
              variants={item}
              className="relative col-span-1 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 md:col-span-7"
            >
              {/* Gradient header instead of image */}
              <div className="relative h-36 w-full bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Car className="w-20 h-20 text-white/20" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-white tracking-wider font-mono">
                      {currentSession.vehicle.license_plate}
                    </span>
                    {currentSession.vehicle.vehicle_type && (
                      <span className="text-xs font-medium text-white/70 bg-white/20 px-2 py-0.5 rounded-full uppercase">
                        {currentSession.vehicle.vehicle_type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/80 mt-0.5">
                    {[
                      currentSession.vehicle.color,
                      currentSession.vehicle.make,
                      currentSession.vehicle.model,
                    ]
                      .filter(Boolean)
                      .join(" ") || "Vehicle Details"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-4 text-sm md:grid-cols-3">
                <InfoRow
                  icon={MapPin}
                  label="Parking Slot"
                  value={
                    currentSession.slot?.slot_number ?? "Assigning..."
                  }
                />
                <InfoRow
                  icon={Clock}
                  label="Duration"
                  value={currentSession.duration ?? "0m"}
                />
                <InfoRow
                  icon={Banknote}
                  label="Est. Cost"
                  value={`Rs.${estimatedCost}`}
                />
              </div>

              {/* Venue + Floor/Zone info */}
              <div className="px-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {currentSession.venue.name}
                        {currentSession.slot?.floor_level &&
                          ` • Floor ${currentSession.slot.floor_level}`}
                        {currentSession.slot?.zone &&
                          ` • ${currentSession.slot.zone}`}
                      </span>
                    </div>
                    {currentSession.staff_name && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        <span>Valet: {currentSession.staff_name}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>

            {/* Quick actions + stats */}
            <motion.div variants={item} className="col-span-1 md:col-span-5">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="mb-3 text-base font-semibold dark:text-white">
                  Quick Actions
                </h3>
                <div className="grid gap-2">
                  {/* Retrieve Vehicle Button */}
                  {currentSession.retrieval_status === "requested" ||
                    currentSession.retrieval_status === "in_progress" ? (
                    <div className="flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Bell className="h-5 w-5 text-amber-600" />
                      </motion.div>
                      <div className="flex-1">
                        <span className="font-semibold text-amber-800">
                          Retrieval{" "}
                          {currentSession.retrieval_status === "requested"
                            ? "Requested"
                            : "In Progress"}
                        </span>
                        <p className="text-xs text-amber-600 mt-0.5">
                          {currentSession.retrieval_status === "requested"
                            ? "Staff will bring your vehicle shortly"
                            : "Your vehicle is being brought to you"}
                        </p>
                      </div>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <Loader2 className="h-4 w-4 text-amber-500" />
                      </motion.div>
                    </div>
                  ) : currentSession.retrieval_status === "ready" ? (
                    <div className="flex w-full items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div className="flex-1">
                        <span className="font-semibold text-emerald-800">
                          Vehicle Ready!
                        </span>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          Your vehicle is waiting at the pickup point
                        </p>
                      </div>
                    </div>
                  ) : (
                    <QuickAction
                      icon={Car}
                      label="Request Vehicle Retrieval"
                      intent="primary"
                      loading={retrievalLoading === currentSession.id}
                      onClick={() =>
                        handleRetrieveVehicle(currentSession.id)
                      }
                    />
                  )}

                  {retrievalSuccess === currentSession.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Retrieval request sent! Staff will bring your
                      vehicle.
                    </motion.div>
                  )}

                  <QuickAction
                    icon={Video}
                    label="View Live Parking Feed"
                    onClick={() => setActiveTab("Live Feed")}
                  />
                  <QuickAction
                    icon={Sparkles}
                    label="Book Cleaning Service"
                    onClick={() => setActiveTab("Services")}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-3">
                  <StatBox
                    label="Current Duration"
                    value={currentSession.duration ?? "0m"}
                    align="right"
                  />
                  <StatBox
                    label="Estimated Cost"
                    value={`Rs.${estimatedCost}`}
                    align="right"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Car className="w-16 h-16 opacity-20 mb-3" />
            <p className="text-base font-medium text-slate-500 dark:text-slate-400">
              No Vehicle Currently Parked
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Your active parking session will appear here
            </p>
          </div>
        )}
      </motion.section>

      {/* ── Multiple Active Sessions Notice ────────────────────────────────── */}
      {activeSessions.length > 1 && (
        <motion.div
          variants={item}
          className="mt-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-sky-600" />
            <span className="text-sm font-semibold text-sky-800 dark:text-sky-300">
              {activeSessions.length} Active Parking Sessions
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeSessions.slice(1).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-800 px-3 py-2 border border-sky-100 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-sky-600" />
                  <span className="font-mono font-bold text-sm">
                    {session.vehicle.license_plate}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {session.slot?.slot_number} • {session.duration}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <motion.nav variants={item} className="mt-6">
        <div className="overflow-x-auto scrollbar-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
          <div className="flex gap-1 min-w-max">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`relative shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === t
                  ? "bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </motion.nav>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <section className="mt-4">
        <AnimatePresence mode="wait">
          {activeTab === "Parking History" && (
            <ParkingHistoryTab
              sessions={completedSessions}
              loading={loadingHistory}
              onRefresh={fetchCompletedSessions}
            />
          )}

          {activeTab === "Live Feed" && <LiveFeedTab currentSession={currentSession} />}

          {activeTab === "Services" && <ServicesTab activeSessions={activeSessions} />}

          {activeTab === "Payment" && <PaymentTab sessions={completedSessions} />}
        </AnimatePresence>
      </section>

      {/* ── Car arrived alert banner ─────────────────────────────────────────── */}
      <AnimatePresence>
        {carArrivedAlert && receiptSession && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 shadow-2xl text-white">
              <PartyPopper className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">Your car has arrived!</p>
                <p className="text-xs opacity-80 truncate">{receiptSession.vehicle.license_plate} is at the pickup point</p>
              </div>
              <button
                onClick={() => { setCarArrivedAlert(false); setReceiptSession(receiptSession); }}
                className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
              >
                View Receipt
              </button>
              <button onClick={() => setCarArrivedAlert(false)} className="shrink-0 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Receipt Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {receiptSession && !carArrivedAlert && !showRating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 pt-6 pb-8 text-white text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-90" />
                <h2 className="text-xl font-black">Checkout Complete</h2>
                <p className="text-sm opacity-80 mt-0.5">
                  {receiptSession.vehicle.license_plate}
                  {[receiptSession.vehicle.color, receiptSession.vehicle.make, receiptSession.vehicle.model]
                    .filter(Boolean).length > 0 &&
                    ` · ${[receiptSession.vehicle.color, receiptSession.vehicle.make, receiptSession.vehicle.model].filter(Boolean).join(" ")}`}
                </p>
              </div>

              {/* Receipt body */}
              <div className="px-6 py-5 space-y-3 text-sm -mt-4">
                <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-2.5 shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Venue</span>
                    <span className="font-semibold dark:text-white">{receiptSession.venue.name}</span>
                  </div>
                  {receiptSession.slot?.slot_number && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Slot</span>
                      <span className="font-semibold dark:text-white">{receiptSession.slot.slot_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Duration</span>
                    <span className="font-semibold dark:text-white">{receiptSession.duration ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Rate</span>
                    <span className="font-semibold dark:text-white">PKR {receiptSession.rate_per_hour}/hr</span>
                  </div>
                  {receiptSession.exit_time && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Checked out</span>
                      <span className="font-semibold dark:text-white">
                        {new Date(receiptSession.exit_time).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Total</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      PKR {receiptSession.total_amount?.toFixed(0) ?? "0"}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowRating(true)}
                  className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
                >
                  Rate Your Experience
                </motion.button>
                <button
                  onClick={() => { setReceiptSession(null); fetchCompletedSessions(); }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rating Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {receiptSession && showRating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-5"
            >
              <div className="text-center">
                <div className="flex justify-center mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-7 w-7 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <h2 className="text-lg font-bold dark:text-white">How was your experience?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{receiptSession.vehicle.license_plate} · {receiptSession.venue.name}</p>
              </div>
              <InlineRatingForm
                sessionId={receiptSession.id}
                onDone={() => {
                  setReceiptSession(null);
                  setShowRating(false);
                  fetchCompletedSessions();
                }}
              />
              <button
                onClick={() => { setReceiptSession(null); setShowRating(false); fetchCompletedSessions(); }}
                className="w-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Skip for now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Inline Rating Form (used inside the modal)
// ══════════════════════════════════════════════════════════════════════════════

function InlineRatingForm({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, rating_comment: comment || undefined }),
      });
      if (res.ok) onDone();
    } catch {
      // silent — user can skip
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stars */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(s)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-9 w-9 transition-colors ${s <= (hover || rating) ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"
                }`}
            />
          </button>
        ))}
      </div>

      {/* Labels */}
      {rating > 0 && (
        <p className="text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
          {["", "Poor", "Fair", "Good", "Very Good", "Excellent!"][rating]}
        </p>
      )}

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Any comments? (optional)"
        rows={2}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none dark:text-white dark:placeholder-slate-400"
      />

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={submit}
        disabled={rating === 0 || submitting}
        className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Rating"}
      </motion.button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Parking History (Real data)
// ══════════════════════════════════════════════════════════════════════════════

function ParkingHistoryTab({
  sessions,
  loading,
  onRefresh,
}: {
  sessions: CompletedSession[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Recent Parking Sessions
        </h4>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <History className="w-12 h-12 opacity-20 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            No parking history yet
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Your completed sessions will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => (
            <HistoryCard key={s.id} session={s} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── History Card with Star Rating ───────────────────────────────────────────

function HistoryCard({ session: s, index }: { session: CompletedSession; index: number }) {
  const [rating, setRating] = React.useState<number>(s.rating ?? 0);
  const [hover, setHover] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>(s.rating_comment ?? "");
  const [showComment, setShowComment] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(s.rating != null);

  const submitRating = async (stars: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${s.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars, rating_comment: comment || undefined }),
      });
      if (res.ok) {
        setRating(stars);
        setSubmitted(true);
        setShowComment(false);
      }
    } catch {
      // silently ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/30 shrink-0">
            <History className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <div className="font-medium dark:text-slate-100">{s.venue.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(s.entry_time).toLocaleDateString("en-PK", {
                month: "short", day: "numeric", year: "numeric",
              })}{" "}•{" "}
              <span className="font-mono">{s.vehicle.license_plate}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold dark:text-white">
            Rs.{s.total_amount?.toFixed(0) ?? "0"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{s.duration ?? "—"}</div>
        </div>
      </div>

      {/* Star Rating */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        {submitted ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${star <= rating ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {s.rating_comment || "Thank you for your rating!"}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Rate this session:</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    disabled={submitting}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => {
                      setRating(star);
                      setShowComment(true);
                    }}
                    className="p-0.5 disabled:opacity-50"
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${star <= (hover || rating) ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            {showComment && rating > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment (optional)..."
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 dark:text-white"
                />
                <button
                  onClick={() => submitRating(rating)}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit"}
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Live Feed (Active Camera Stream)
// ══════════════════════════════════════════════════════════════════════════════

function LiveFeedTab({ currentSession }: { currentSession: ActiveSession | null }) {
  if (!currentSession) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
          <Video className="w-8 h-8 text-sky-600" />
        </div>
        <h5 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
          No Active Parking Session
        </h5>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          A live camera feed will appear here when your vehicle is actively parked.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      key="livefeed"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-sky-600" />
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Live Parking Camera Feed
          </h4>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <WebRTCViewer compact={false} venueId={currentSession.venue.id} gateId={currentSession.gate_id || undefined} hideInstructions={true} />
      </div>
    </motion.div>
  );
}

// ── Live Timestamp Component ────────────────────────────────────────────────
function LiveTimestamp() {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-xs font-mono text-white/80">
      {time.toLocaleTimeString("en-PK", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Services
// ══════════════════════════════════════════════════════════════════════════════

const WASH_TIERS: {
  type: "basic" | "full" | "premium";
  label: string;
  icon: React.ElementType;
  cost: number;
  description: string;
  color: string;
  bgColor: string;
  ringColor: string;
  badgeBg: string;
}[] = [
    {
      type: "basic",
      label: "Basic Wash",
      icon: Droplets,
      cost: 500,
      description: "Exterior rinse & dry",
      color: "text-sky-600",
      bgColor: "bg-sky-50 dark:bg-sky-900/30",
      ringColor: "ring-sky-500",
      badgeBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    },
    {
      type: "full",
      label: "Full Wash",
      icon: Sparkles,
      cost: 1000,
      description: "Exterior wash + interior vacuum",
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-900/30",
      ringColor: "ring-violet-500",
      badgeBg: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    },
    {
      type: "premium",
      label: "Premium Detail",
      icon: Wand2,
      cost: 2000,
      description: "Full detail, wax & polish",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-900/30",
      ringColor: "ring-amber-500",
      badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
  ];

function ServicesTab({ activeSessions }: { activeSessions: ActiveSession[] }) {
  const [washRequests, setWashRequests] = React.useState<WashRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = React.useState(true);
  const [selectedSession, setSelectedSession] = React.useState<string>("");
  const [bookingType, setBookingType] = React.useState<"" | "basic" | "full" | "premium">("");
  const [bookingLoading, setBookingLoading] = React.useState(false);
  const [bookingError, setBookingError] = React.useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = React.useState(false);

  // ── Fetch wash requests ─────────────────────────────────────────────────
  const fetchWashRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch("/api/wash/my-requests");
      if (res.ok) {
        const data = await res.json();
        setWashRequests(data.requests);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingRequests(false);
    }
  };

  React.useEffect(() => {
    fetchWashRequests();
  }, []);

  // Auto-select first active session
  React.useEffect(() => {
    if (activeSessions.length > 0 && !selectedSession) {
      setSelectedSession(activeSessions[0].id);
    }
  }, [activeSessions, selectedSession]);

  // ── Booking handler ─────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!selectedSession || !bookingType) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/wash/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: selectedSession, wash_type: bookingType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || "Booking failed");
        return;
      }
      setBookingSuccess(true);
      setBookingType("");
      await fetchWashRequests();
      setTimeout(() => setBookingSuccess(false), 4000);
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Derived state ───────────────────────────────────────────────────────
  const activeWash = washRequests.find(
    (r) =>
      r.session_id === selectedSession &&
      (r.service_status === "pending" || r.service_status === "in_progress")
  );

  const completedWashes = washRequests.filter(
    (r) => r.service_status === "completed"
  ).slice(0, 5);

  const hasActiveWash = !!activeWash;

  // ── Helpers ─────────────────────────────────────────────────────────────
  const washTypeBadge = (type: string) => {
    const tier = WASH_TIERS.find((t) => t.type === type);
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tier?.badgeBg ?? "bg-slate-100 text-slate-600"}`}>
        {tier?.label ?? type}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    if (status === "in_progress") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
          </span>
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </span>
    );
  };

  return (
    <motion.div
      key="services"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="space-y-5"
    >
      {/* ── No active session guard ──────────────────────────────────────── */}
      {activeSessions.length === 0 ? (
        <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-5 text-center">
          <AlertCircle className="w-10 h-10 text-sky-400 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-800 dark:text-white mb-1">
            No Active Parking Session
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You need an active parking session to book a wash service.
          </p>
        </div>
      ) : (
        <>
          {/* ── Session selector (only if multiple) ──────────────────────── */}
          {activeSessions.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                Select vehicle:
              </span>
              {activeSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSession(s.id);
                    setBookingType("");
                    setBookingError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${selectedSession === s.id
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                >
                  <Car className="w-3 h-3" />
                  {s.vehicle?.license_plate ?? "Vehicle"}
                </button>
              ))}
            </div>
          )}

          {/* ── Active wash status banner ─────────────────────────────────── */}
          {activeWash && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-sky-600" />
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                    Wash In Progress
                  </h4>
                </div>
                <button
                  onClick={fetchWashRequests}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingRequests ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {statusBadge(activeWash.service_status)}
                {washTypeBadge(activeWash.wash_type)}
                {activeWash.assigned_to_name && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <User className="w-3 h-3" />
                    {activeWash.assigned_to_name}
                  </span>
                )}
                {activeWash.service_cost != null && (
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    PKR {activeWash.service_cost.toLocaleString()}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Wash tier cards ───────────────────────────────────────────── */}
          {!hasActiveWash && (
            <>
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Choose a Wash Service
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {WASH_TIERS.map((tier) => {
                  const isSelected = bookingType === tier.type;
                  return (
                    <motion.button
                      key={tier.type}
                      onClick={() => {
                        setBookingType(isSelected ? "" : tier.type);
                        setBookingError(null);
                      }}
                      variants={subtleHover}
                      initial="rest"
                      whileHover="hover"
                      animate="rest"
                      className={`relative rounded-2xl border p-5 text-left transition-all ${isSelected
                        ? `border-transparent ring-2 ${tier.ringColor} bg-white dark:bg-slate-800 shadow-md`
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm"
                        }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="wash-selected"
                          className="absolute top-3 right-3"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${tier.color}`} />
                        </motion.div>
                      )}
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tier.bgColor} mb-3`}>
                        <tier.icon className={`h-5 w-5 ${tier.color}`} />
                      </div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white">
                        {tier.label}
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {tier.description}
                      </p>
                      <div className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">
                        PKR {tier.cost.toLocaleString()}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* ── Error banner ──────────────────────────────────────────── */}
              <AnimatePresence>
                {bookingError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-300">
                      {bookingError}
                    </span>
                    <button
                      onClick={() => setBookingError(null)}
                      className="ml-auto p-1 rounded hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Success toast ─────────────────────────────────────────── */}
              <AnimatePresence>
                {bookingSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Wash booked! A washer has been assigned.
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Book button ───────────────────────────────────────────── */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleBook}
                disabled={!bookingType || !selectedSession || bookingLoading}
                className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {bookingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Booking…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Book Wash
                  </>
                )}
              </motion.button>
            </>
          )}

          {/* ── Wash history ──────────────────────────────────────────────── */}
          {completedWashes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
                Recent Wash History
              </h4>
              <div className="space-y-2">
                {completedWashes.map((req, i) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {washTypeBadge(req.wash_type)}
                          {req.after_photos.length > 0 && (
                            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                              📸 {req.after_photos.length} photo{req.after_photos.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {new Date(req.created_at).toLocaleDateString("en-PK", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {req.completed_at && req.started_at && (() => {
                            const mins = Math.round(
                              (new Date(req.completed_at).getTime() - new Date(req.started_at).getTime()) / 60000
                            );
                            return ` • ${mins} min`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      PKR {(req.service_cost ?? 0).toLocaleString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Payment (real payment history)
// ══════════════════════════════════════════════════════════════════════════════

function PaymentTab({ sessions }: { sessions: CompletedSession[] }) {
  const totalSpent = sessions.reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
  const paidSessions = sessions.filter((s) => s.payment_status === 'completed' || s.total_amount != null);

  return (
    <motion.div
      key="payment"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="space-y-4"
    >
      {/* Summary card */}
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-800">
            <Banknote className="h-5 w-5 text-violet-600 dark:text-violet-300" />
          </div>
          <div>
            <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Total Spent</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">Rs.{totalSpent.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span><strong className="text-slate-800 dark:text-white">{sessions.length}</strong> sessions total</span>
          <span><strong className="text-slate-800 dark:text-white">{paidSessions.length}</strong> paid</span>
        </div>
      </div>

      {/* Payment history list */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Payment History</h4>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Receipt className="w-12 h-12 opacity-20 mb-3" />
            <p className="text-sm font-medium text-slate-500">No payment history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                    <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-white font-mono">
                      {s.vehicle.license_plate}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {s.venue.name} • {s.exit_time
                        ? new Date(s.exit_time).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Rs.{(s.total_amount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400">{s.duration ?? '—'}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════════════════════════════════════

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

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/70 dark:bg-slate-700/50 p-2 text-slate-700 dark:text-slate-200">
      <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="ml-auto font-semibold tracking-wide text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  intent = "neutral",
  onClick,
  loading = false,
}: {
  icon: React.ElementType;
  label: string;
  intent?: "primary" | "neutral";
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <motion.button
      variants={subtleHover}
      initial="rest"
      whileHover="hover"
      whileTap={{ scale: 0.995 }}
      animate="rest"
      onClick={onClick}
      disabled={loading}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70 disabled:cursor-not-allowed ${intent === "primary"
        ? "border-sky-600 bg-sky-600 text-white shadow-sm hover:bg-sky-700 focus-visible:ring-sky-500"
        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:ring-slate-300"
        }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 opacity-50" />
    </motion.button>
  );
}

function StatBox({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`rounded-lg bg-white dark:bg-slate-700 p-3 ${align === "right" ? "text-right" : "text-left"
        }`}
    >
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight dark:text-white">
        {value}
      </div>
    </div>
  );
}