"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  CheckCircle2,
  Clock,
  MapPin,
  AlertCircle,
  TrendingUp,
  LogOut,
  User,
  Camera,
  ScanLine,
  Loader2,
  Upload,
  XCircle,
  RefreshCw,
  ImageIcon,
  Send,
  ChevronRight,
  ParkingCircle,
  MessageSquare,
  Search,
  Receipt,
  Truck,
  CheckCircle2 as CircleCheck,
  Ban,
  Radio,
} from "lucide-react";
import DarkModeToggle from "@/components/DarkModeToggle";
import { WebRTCViewer } from "@/components/admin/LiveFeedWidget";
import QRCodeDisplay from "@/components/shared/QRCodeDisplay";
import PhoneInput from "@/components/staff/PhoneInput";
import CustomerLookupResult from "@/components/staff/CustomerLookupResult";
import CheckInStepIndicator from "@/components/staff/CheckInStepIndicator";
import {
  buildWhatsAppTicketLink,
  buildWhatsAppReturningLink,
} from "@/lib/whatsapp";

// ── Animation Presets ────────────────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────────────────

interface StaffInfo {
  id: string;
  full_name: string;
  venue: { id: string; name: string; city: string } | null;
}

interface StaffStats {
  active_tasks: number;
  completed_today: number;
  total_completed: number;
}

interface TaskItem {
  id: string;
  type: string;
  status: string;
  priority: string;
  entry_time: string;
  exit_time: string | null;
  duration: string;
  vehicle: {
    license_plate: string;
    make: string | null;
    model: string | null;
    color: string | null;
    vehicle_type: string;
  };
  venue: { id: string; name: string };
  slot: {
    slot_number: string;
    floor_level: string;
    zone: string;
  };
  customer: { name: string | null; phone: string | null };
  billing: { rate_per_hour: number; total_amount: number | null };
  damage_photos: Array<{ url: string; label: string }>;
}

interface ActiveSession {
  id: string;
  vehicle: { license_plate: string };
  slot: { slot_number: string; floor_level: string; zone: string };
  venue: { name: string };
  entry_time: string;
  duration: string;
  customer_name: string;
  retrieval_status: string | null;
  customer_phone: string | null;
}

interface VenueOption {
  id: string;
  name: string;
  city: string;
}

// ── Check-In Step type (shared with components) ────────────────────────────
type CheckInWizardStep =
  | "scan"
  | "phone"
  | "vehicle"
  | "confirm"
  | "slot"
  | "damage"
  | "done";

// Maps wizard steps to the CheckInStepIndicator steps
const WIZARD_TO_INDICATOR: Record<
  CheckInWizardStep,
  "scan" | "customer" | "vehicle" | "confirm" | "success"
> = {
  scan: "scan",
  phone: "customer",
  vehicle: "vehicle",
  confirm: "confirm",
  slot: "success",
  damage: "success",
  done: "success",
};

// ── Tabs ─────────────────────────────────────────────────────────────────
const tabs = ["Active Vehicles", "Check-In", "Check-Out", "Tasks", "Performance"] as const;
type TabKey = (typeof tabs)[number];

export default function StaffDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabKey>("Active Vehicles");
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Staff info
  const [staffInfo, setStaffInfo] = React.useState<StaffInfo | null>(null);
  const [staffStats, setStaffStats] = React.useState<StaffStats>({
    active_tasks: 0,
    completed_today: 0,
    total_completed: 0,
  });

  // Active vehicles (real data)
  const [activeVehicles, setActiveVehicles] = React.useState<ActiveSession[]>(
    []
  );
  const [loadingVehicles, setLoadingVehicles] = React.useState(true);

  // Tasks (real data)
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(true);

  React.useEffect(() => setMounted(true), []);

  // Guard ref: prevent the fallback (demo) fetch from running more than once
  const fallbackFetchedRef = React.useRef(false);

  // ── Fetch staff info ──────────────────────────────────────────────────
  const fetchStaffInfo = React.useCallback(async () => {
    try {
      // Try authenticated endpoint first
      const res = await fetch("/api/staff/me");
      if (res.ok) {
        const data = await res.json();
        setStaffInfo(data.staff);
        setStaffStats(data.stats);
        return;
      }

      // Fallback: if not logged in, use staff member with most tasks for demo
      // Use a ref guard instead of reading staffInfo state to keep the
      // callback identity stable and avoid an infinite re-render loop.
      if (res.status === 401 && !fallbackFetchedRef.current) {
        fallbackFetchedRef.current = true;
        const staffRes = await fetch("/api/staff");
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          const allStaff = staffData.staff ?? [];
          // Pick the staff with most active tasks for a meaningful demo
          const bestStaff = allStaff.sort(
            (a: Record<string, number>, b: Record<string, number>) =>
              (b.active_tasks || 0) - (a.active_tasks || 0)
          )[0];
          if (bestStaff) {
            setStaffInfo({
              id: bestStaff.id,
              full_name: bestStaff.full_name,
              venue: bestStaff.venue
                ? { id: bestStaff.venue.id, name: bestStaff.venue.name, city: "" }
                : null,
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch staff info:", err);
    }
  }, []); // ← stable identity: no state deps

  // ── Fetch active vehicles at staff's venue ────────────────────────────
  const fetchActiveVehicles = React.useCallback(async () => {
    try {
      setLoadingVehicles(true);
      const res = await fetch("/api/sessions?status=active");
      if (res.ok) {
        const data = await res.json();
        const sessions = data.sessions ?? [];
        setActiveVehicles(
          sessions.map((s: Record<string, unknown>) => ({
            id: s.id,
            vehicle: s.vehicle,
            slot: s.slot,
            venue: s.venue,
            entry_time: s.entry_time,
            duration: s.duration || "0m",
            customer_name:
              (s.customer as Record<string, unknown>)?.name || "Walk-in",
            retrieval_status: (s as Record<string, unknown>).retrieval_status as string | null ?? null,
            customer_phone: (s.customer as Record<string, unknown>)?.phone as string | null ?? null,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  // ── Fetch task queue ──────────────────────────────────────────────────
  const fetchTasks = React.useCallback(async () => {
    if (!staffInfo?.id) return;
    try {
      setLoadingTasks(true);
      const res = await fetch(
        `/api/staff/tasks?staff_id=${staffInfo.id}&status=all`
      );
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
        setStaffStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [staffInfo?.id]);

  React.useEffect(() => {
    fetchStaffInfo();
    fetchActiveVehicles();
  }, [fetchStaffInfo, fetchActiveVehicles]);

  React.useEffect(() => {
    if (staffInfo?.id) fetchTasks();
  }, [staffInfo?.id, fetchTasks]);

  // Refresh active vehicles whenever the tab is switched to "Active Vehicles"
  React.useEffect(() => {
    if (activeTab === "Active Vehicles") {
      fetchActiveVehicles();
    }
  }, [activeTab, fetchActiveVehicles]);

  // Auto-refresh every 60s
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveVehicles();
      if (staffInfo?.id) fetchTasks();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchActiveVehicles, fetchStaffInfo, fetchTasks, staffInfo?.id]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!mounted) {
    return <main className="mx-auto max-w-6xl px-4 pb-24 pt-10" />;
  }

  return (
    <motion.main
      className="mx-auto max-w-6xl px-4 pb-24 pt-6 text-slate-800 dark:text-slate-100 min-h-screen"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Dark Mode Background */}
      <div className="fixed inset-0 -z-10 bg-slate-50 dark:bg-slate-900 transition-colors duration-300" />
      {/* Header */}
      <motion.header
        variants={item}
        className="mb-5 flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Valet Staff
              </span>
            </div>
            {staffInfo?.venue && (
              <div className="flex items-center gap-1 bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 max-w-[160px]">
                <MapPin className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-xs font-medium text-sky-700 dark:text-sky-300 truncate">
                  {staffInfo.venue.name}
                </span>
              </div>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight dark:text-white">
            Staff Dashboard
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {staffInfo?.full_name || "Valet Attendant"}
          </p>
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

      {/* Stats */}
      <motion.section
        variants={item}
        className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <StatCard
          icon={Car}
          label="Active Vehicles"
          value={String(activeVehicles.length)}
          subtext="Currently parked"
          color="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Active Tasks"
          value={String(staffStats.active_tasks)}
          subtext="Assigned to you"
          color="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Tasks Today"
          value={String(staffStats.completed_today)}
          subtext="Completed"
          color="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Completed"
          value={String(staffStats.total_completed)}
          subtext="All time"
          color="bg-purple-50"
          iconColor="text-purple-600"
        />
      </motion.section>

      {/* Quick Actions */}
      <motion.section
        variants={item}
        className="mb-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors duration-300"
      >
        <div className="mb-4 flex items-center gap-2">
          <StatusPill label="On Duty" />
          <span className="text-sm font-medium text-slate-500">
            Quick Actions
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            icon={Car}
            label="Check-in Vehicle"
            intent="primary"
            onClick={() => setActiveTab("Check-In")}
          />
          <QuickAction
            icon={Receipt}
            label="Check-Out Vehicle"
            intent="checkout"
            onClick={() => setActiveTab("Check-Out")}
          />
          <QuickAction
            icon={ParkingCircle}
            label="Active Vehicles"
            onClick={() => setActiveTab("Active Vehicles")}
          />
        </div>
      </motion.section>

      {/* Tabs */}
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

      {/* Content */}
      <section className="mt-4">
        <AnimatePresence mode="wait">
          {activeTab === "Active Vehicles" && (
            <ActiveVehiclesTab
              vehicles={activeVehicles}
              loading={loadingVehicles}
              onRefresh={fetchActiveVehicles}
              onRetrievalUpdate={() => {
                fetchActiveVehicles();
                fetchTasks();
                fetchStaffInfo();
              }}
            />
          )}
          {activeTab === "Check-In" && (
            <CheckInTab
              staffVenue={staffInfo?.venue || null}
              staffId={staffInfo?.id || null}
              onSuccess={() => {
                fetchActiveVehicles();
                fetchTasks();
                fetchStaffInfo();
                setActiveTab("Active Vehicles");
              }}
            />
          )}
          {activeTab === "Check-Out" && (
            <CheckOutTab
              onSuccess={() => {
                fetchActiveVehicles();
                fetchTasks();
                fetchStaffInfo();
              }}
            />
          )}
          {activeTab === "Tasks" && (
            <TasksTab
              tasks={tasks}
              loading={loadingTasks}
              onRefresh={fetchTasks}
            />
          )}
          {activeTab === "Performance" && (
            <PerformanceTab stats={staffStats} />
          )}
        </AnimatePresence>
      </section>
    </motion.main>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: Active Vehicles
// ══════════════════════════════════════════════════════════════════════════

function ActiveVehiclesTab({
  vehicles,
  loading,
  onRefresh,
  onRetrievalUpdate,
}: {
  vehicles: ActiveSession[];
  loading: boolean;
  onRefresh: () => void;
  onRetrievalUpdate: () => void;
}) {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const handleRetrievalAction = async (sessionId: string, newStatus: "in_progress" | "ready") => {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/retrieval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onRetrievalUpdate();
      } else {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <motion.div
      key="vehicles"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Currently Parked Vehicles
        </h4>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Car className="w-12 h-12 opacity-30 mb-2" />
          <p className="text-sm font-medium">No vehicles currently parked</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <motion.div
              key={v.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
              variants={subtleHover}
              initial="rest"
              whileHover="hover"
              animate="rest"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${v.retrieval_status === "in_progress" ? "bg-amber-50" :
                    v.retrieval_status === "requested" ? "bg-orange-50" : "bg-sky-50"
                    }`}>
                    <Car className={`h-5 w-5 ${v.retrieval_status === "in_progress" ? "text-amber-600" :
                      v.retrieval_status === "requested" ? "text-orange-600" : "text-sky-600"
                      }`} />
                  </div>
                  <div>
                    <div className="font-bold font-mono tracking-wider dark:text-white">
                      {(v.vehicle as { license_plate: string }).license_plate}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {v.customer_name} •{" "}
                      {new Date(v.entry_time).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <MapPin className="h-3 w-3" />
                    {(v.slot as { slot_number: string }).slot_number}
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{v.duration}</div>
                </div>
              </div>

              {/* Retrieval action buttons */}
              {v.retrieval_status === "requested" && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-orange-600 font-medium">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                      </span>
                      Retrieval requested
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      disabled={actionLoading === v.id}
                      onClick={() => handleRetrievalAction(v.id, "in_progress")}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                      Start Retrieval
                    </motion.button>
                  </div>
                </div>
              )}

              {v.retrieval_status === "in_progress" && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                      <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                      Bringing car to pickup
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      disabled={actionLoading === v.id}
                      onClick={() => handleRetrievalAction(v.id, "ready")}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleCheck className="h-3 w-3" />}
                      Car Delivered
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: Check-In
// Flow: scan → phone → details → confirm → slot → damage → done
// ══════════════════════════════════════════════════════════════════════════

type CheckInStep =
  | "scan"
  | "phone"
  | "vehicle"
  | "confirm"
  | "slot"
  | "damage"
  | "done";

interface CheckinSlot {
  id: string;
  slot_number: string;
  floor_level: string | null;
  zone: string | null;
  slot_type: string;
}
interface CheckinVenue { id: string; name: string; address: string | null; phone: string | null; }
interface CheckinSession {
  id: string; qr_code: string; license_plate: string; status: string;
  sms_code?: string | null; rate_per_hour: number; entry_time: string;
  venue_name: string; venue_address?: string | null; venue_phone?: string | null;
  slot_number: string; customer_id?: string | null; customer_name?: string | null;
  customer_phone?: string | null; magic_token?: string | null;
  valet_staff_id?: string | null; valet_staff_name?: string | null;
  slot: CheckinSlot | null; venue: CheckinVenue | null; pricing_metadata?: unknown;
}

interface CustomerLookup {
  found: boolean;
  isReturning: boolean;
  matchedByPhone: boolean;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email?: string;
    total_visits: number;
    active_sessions?: number;
    last_visit?: string | null;
  } | null;
  vehicle: {
    id?: string;
    license_plate: string;
    make: string | null;
    model: string | null;
    color: string | null;
    year?: number | null;
    vehicle_type: string;
  } | null;
}

function CheckInTab({
  staffVenue,
  staffId,
  onSuccess,
}: {
  staffVenue: { id: string; name: string; city: string } | null;
  staffId: string | null;
  onSuccess: () => void;
}) {
  // ── Step state ─────────────────────────────────────────────────────────
  const [step, setStep] = React.useState<CheckInStep>("scan");

  // Step 1 — ANPR
  const [plate, setPlate] = React.useState("");
  const [anprLoading, setAnprLoading] = React.useState(false);
  const [anprImage, setAnprImage] = React.useState<string | null>(null);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [scanMode, setScanMode] = React.useState<'livefeed' | 'upload' | 'camera'>('livefeed');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Step 2 — Phone lookup
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [normalizedPhone, setNormalizedPhone] = React.useState("");
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [customerLookup, setCustomerLookup] = React.useState<CustomerLookup | null>(null);
  const [isReturning, setIsReturning] = React.useState(false);
  const lookupAbortRef = React.useRef<AbortController | null>(null);

  // WhatsApp
  const [whatsappSent, setWhatsappSent] = React.useState(false);

  // Step 3 — Vehicle details
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [color, setColor] = React.useState("");
  const [vehicleType, setVehicleType] = React.useState("car");
  const [venues, setVenues] = React.useState<VenueOption[]>([]);
  const [selectedVenue, setSelectedVenue] = React.useState(staffVenue?.id || "");

  // Plate lookup (after scan step)
  const [isKnownPlate, setIsKnownPlate] = React.useState(false);
  const [plateLookupLoading, setPlateLookupLoading] = React.useState(false);

  // Submit / result
  const [checkinLoading, setCheckinLoading] = React.useState(false);
  const [checkinResult, setCheckinResult] = React.useState<{ session: CheckinSession } | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");

  // Damage photos (post-slot step)
  const [damagePhotos, setDamagePhotos] = React.useState<Array<{ data: string; label: string }>>([]);
  const [damageNotes, setDamageNotes] = React.useState("");
  const [uploadingDamage, setUploadingDamage] = React.useState(false);
  const [damageUploaded, setDamageUploaded] = React.useState(false);
  const damageFileRef = React.useRef<HTMLInputElement>(null);

  // Fetch venues on mount
  React.useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        setVenues(d.locations ?? []);
        if (staffVenue?.id) setSelectedVenue(staffVenue.id);
      })
      .catch(console.error);
  }, [staffVenue?.id]);

  // ── Camera helpers ──────────────────────────────────────────────────────
  const startCamera = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch { alert("Could not access camera"); }
  }, []);

  const stopCamera = React.useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const runAnpr = React.useCallback(async (dataUrl: string) => {
    setAnprLoading(true);
    try {
      const res = await fetch("/api/anpr/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, user_info: "staff" }),
      });
      const data = await res.json();
      if (data.success && data.plates?.length > 0) setPlate(data.plates[0].ocr_text);
    } catch { console.error("ANPR detection failed"); }
    finally { setAnprLoading(false); }
  }, []);

  const captureAndDetect = React.useCallback(async () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setAnprImage(dataUrl); stopCamera();
    await runAnpr(dataUrl);
  }, [stopCamera, runAnpr]);

  const handleFileUpload = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setAnprImage(dataUrl);
      await runAnpr(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [runAnpr]);

  // ── Phone lookup (called when PhoneInput fires onValidNumber) ────────────
  const handleValidPhone = React.useCallback(async (normalized: string) => {
    setNormalizedPhone(normalized);
    setLookupLoading(true);
    setCustomerLookup(null);

    // Cancel any in-flight request
    if (lookupAbortRef.current) lookupAbortRef.current.abort();
    lookupAbortRef.current = new AbortController();

    try {
      const params = new URLSearchParams({ phone: normalized });
      if (plate) params.set("plate", plate);
      const res = await fetch(`/api/customers/lookup?${params}`, {
        signal: lookupAbortRef.current.signal,
      });
      const data: CustomerLookup = await res.json();
      setCustomerLookup(data);
      // Only treat as "returning" when the phone directly matched an account
      setIsReturning((data.isReturning && data.matchedByPhone) ?? false);

      // Auto-fill vehicle details from plate lookup or customer vehicle
      if (data.vehicle) {
        if (data.vehicle.make) setMake(data.vehicle.make);
        if (data.vehicle.model) setModel(data.vehicle.model);
        if (data.vehicle.color) setColor(data.vehicle.color);
        setVehicleType(data.vehicle.vehicle_type || "car");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        console.error("Phone lookup failed", e);
      }
    } finally {
      setLookupLoading(false);
    }
  }, [plate]);

  // ── Plate lookup — decides whether to skip phone step ──────────────────
  const handlePlateNext = React.useCallback(async () => {
    if (!plate) return;

    // BUG 1: Clear stale data from previous check-in before every lookup
    setMake("");
    setModel("");
    setColor("");
    setVehicleType("car");
    setCustomerPhone("");
    setNormalizedPhone("");
    setCustomerLookup(null);
    setIsReturning(false);
    setIsKnownPlate(false);

    setPlateLookupLoading(true);
    try {
      // BUG 8: Normalize plate before sending to API
      const normalizedPlate = plate.toUpperCase().replace(/\s+/g, "-").trim();
      const res = await fetch(`/api/customers/lookup?plate=${encodeURIComponent(normalizedPlate)}`);
      if (res.ok) {
        const data: CustomerLookup = await res.json();

        // BUG 2: A plate is "known" if the VEHICLE exists, regardless of owner
        const vehicleFound = data.vehicle !== null && data.vehicle !== undefined;

        if (vehicleFound) {
          // Known plate — auto-fill whatever we have from DB
          if (data.vehicle) {
            if (data.vehicle.make) setMake(data.vehicle.make);
            if (data.vehicle.model) setModel(data.vehicle.model);
            if (data.vehicle.color) setColor(data.vehicle.color);
            setVehicleType(data.vehicle.vehicle_type || "car");
          }
          if (data.customer && data.customer.phone) {
            setCustomerLookup(data);
            setIsReturning(true);
            setCustomerPhone(data.customer.phone);
            setNormalizedPhone(data.customer.phone);
          }
          setIsKnownPlate(true);

          // Skip to confirm if we have a linked customer, else ask for phone
          if (data.customer && data.customer.id) {
            setStep("confirm");
          } else {
            setStep("phone");
          }
        } else {
          // Completely new plate — need phone and vehicle details
          setIsKnownPlate(false);
          setStep("phone");
        }
      } else {
        setIsKnownPlate(false);
        setStep("phone");
      }
    } catch {
      setIsKnownPlate(false);
      setStep("phone");
    } finally {
      setPlateLookupLoading(false);
    }
  }, [plate]);

  // ── Check-in submit ─────────────────────────────────────────────────────
  const handleCheckin = React.useCallback(async () => {
    if (!plate || !selectedVenue) { setErrorMsg("License plate and venue are required"); return; }
    setCheckinLoading(true); setErrorMsg("");
    try {
      const res = await fetch("/api/sessions/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_plate: plate,
          venue_id: selectedVenue,
          vehicle_type: vehicleType,
          make: make || undefined,
          model: model || undefined,
          color: color || undefined,
          customer_phone: customerPhone || undefined,
          customer_id: customerLookup?.customer?.id || undefined,
          ...(staffId ? { staff_id: staffId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Check-in failed"); return; }
      setCheckinResult(data);

      setStep("slot");
    } catch { setErrorMsg("Network error. Please try again."); }
    finally { setCheckinLoading(false); }
  }, [plate, selectedVenue, vehicleType, make, model, color, customerPhone, customerLookup, staffId]);

  // ── Damage photo upload ──────────────────────────────────────────────────
  const handleDamageFile = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setDamagePhotos((prev) => [...prev, { data: dataUrl, label: `Photo ${prev.length + 1}` }]);
      };
      reader.readAsDataURL(file);
    });
    if (damageFileRef.current) damageFileRef.current.value = "";
  }, []);

  const handleDamageUpload = React.useCallback(async () => {
    const sessionId = checkinResult?.session?.id;
    if (!sessionId) return;
    setUploadingDamage(true);
    try {
      await fetch(`/api/sessions/${sessionId}/damage-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: damagePhotos, damage_notes: damageNotes || undefined }),
      });
      setDamageUploaded(true);
      setStep("done");
    } catch (err) { console.error("Damage upload failed:", err); }
    finally { setUploadingDamage(false); }
  }, [checkinResult, damagePhotos, damageNotes]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetFlow = () => {
    setStep("scan"); setPlate(""); setAnprImage(null); setErrorMsg(""); setScanMode("livefeed");
    setCustomerPhone(""); setNormalizedPhone(""); setCustomerLookup(null);
    setIsReturning(false); setWhatsappSent(false);
    setIsKnownPlate(false); setPlateLookupLoading(false);
    setMake(""); setModel(""); setColor(""); setVehicleType("car");
    setCheckinResult(null); setDamagePhotos([]); setDamageNotes("");
    setDamageUploaded(false); stopCamera();
  };

  return (
    <motion.div
      key="checkin"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      {/* Step indicator — shown for all steps except damage/done */}
      {!["damage", "done"].includes(step) && (
        <CheckInStepIndicator
          currentStep={WIZARD_TO_INDICATOR[step as CheckInWizardStep]}
          skippedSteps={
            isKnownPlate && customerLookup?.customer?.id
              ? ["customer", "vehicle"]
              : isKnownPlate
                ? ["vehicle"]
                : []
          }
        />
      )}

      {/* ══ STEP 1: ANPR Scan ══════════════════════════════════════════════ */}
      {step === "scan" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step 1 — Scan License Plate</h4>

          {/* Mode selector */}
          <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-1">
            <button
              onClick={() => { stopCamera(); setAnprImage(null); setScanMode('livefeed'); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${scanMode === 'livefeed'
                ? 'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
              <Radio className="h-3.5 w-3.5" /> Live Feed
            </button>
            <button
              onClick={() => { stopCamera(); setAnprImage(null); setScanMode('upload'); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${scanMode === 'upload'
                ? 'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <button
              onClick={() => { setAnprImage(null); setScanMode('camera'); startCamera(); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${scanMode === 'camera'
                ? 'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
              <Camera className="h-3.5 w-3.5" /> Camera
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

          {/* ── Live Feed — phone streams via WebRTC, ANPR auto-fills plate ───── */}
          {scanMode === 'livefeed' && staffVenue?.id && (
            <WebRTCViewer
              compact={true}
              venueId={staffVenue.id}
              onPlateDetected={(p) => setPlate(p)}
            />
          )}
          {scanMode === 'livefeed' && !staffVenue?.id && (
            <p className="text-sm text-slate-400 text-center py-8">
              No venue assigned — cannot start live feed.
            </p>
          )}

          {/* ── Upload ───────────────────────────────────────────────────────── */}
          {scanMode === 'upload' && !anprImage && (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-12 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600">
              <ImageIcon className="h-10 w-10" />
              <p className="font-medium">Click to upload plate image</p>
              <p className="text-xs text-slate-400">JPG, PNG, WEBP</p>
            </button>
          )}

          {/* ── Local camera ─────────────────────────────────────────────────── */}
          {scanMode === 'camera' && cameraActive && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-[9/16]">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                <div className="absolute inset-0 pointer-events-none border-2 border-sky-400/50 rounded-2xl" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.98 }} onClick={captureAndDetect}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700">
                  <ScanLine className="h-4 w-4" /> Capture & Detect
                </motion.button>
                <button onClick={stopCamera} className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {anprImage && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200">
              <img src={anprImage} alt="Plate" className="w-full object-contain max-h-48" />
              <button onClick={() => setAnprImage(null)}
                className="absolute top-2 right-2 rounded-full bg-white/90 dark:bg-slate-700/90 p-1.5 shadow hover:bg-white dark:hover:bg-slate-700">
                <XCircle className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          )}

          {anprLoading && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              <span className="text-sm font-medium text-sky-700">Running AI plate detection…</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">License Plate</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="e.g., LEA-1234"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-4 py-3 text-lg font-mono font-bold tracking-widest text-center focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none dark:placeholder-slate-400" />
          </div>

          <motion.button whileTap={{ scale: 0.98 }} onClick={handlePlateNext} disabled={!plate || plateLookupLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {plateLookupLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking plate…</>
              : <>Next <ChevronRight className="h-4 w-4" /></>}
          </motion.button>
        </div>
      )}

      {/* ══ STEP 2: Customer Phone ══════════════════════════════════════════ */}
      {step === "phone" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step 2 — Customer Phone</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ask the customer for their phone number to identify them and send the WhatsApp ticket.
          </p>

          {/* Plate badge */}
          <div className="rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-3 flex items-center gap-3">
            <Car className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="text-lg font-bold font-mono tracking-widest text-sky-900 dark:text-sky-300">{plate}</span>
            <button
              onClick={() => setStep("scan")}
              className="ml-auto text-xs text-sky-600 dark:text-sky-400 hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Customer Phone Number
            </label>
            <div className="relative">
              <PhoneInput
                value={customerPhone}
                onChange={(v) => {
                  setCustomerPhone(v);
                  setCustomerLookup(null);
                  setIsReturning(false);
                }}
                onValidNumber={handleValidPhone}
                autoFocus
              />
            </div>
          </div>

          {/* Live lookup result */}
          <CustomerLookupResult
            isLoading={lookupLoading}
            result={customerLookup}
            onNewCustomerNameChange={() => {/* name collected via lookup */ }}
          />

          <div className="flex gap-2">
            <button
              onClick={() => setStep("scan")}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Back
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={!normalizedPhone}
              onClick={() => setStep(isKnownPlate ? "confirm" : "vehicle")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Bug 5: Skip button */}
          <button
            type="button"
            onClick={() => {
              setCustomerPhone("");
              setNormalizedPhone("");
              setStep(isKnownPlate ? "confirm" : "vehicle");
            }}
            className="w-full py-2.5 text-sm text-zinc-400 hover:text-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
          >
            Skip — Customer didn&apos;t share phone number
          </button>
        </div>
      )}

      {/* ══ STEP 2.5: Vehicle Details (new plates only) ══════════════════════ */}
      {step === "vehicle" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step — Vehicle Details</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Optional — fill in what you can. These help the valet locate the car.
          </p>

          {/* Plate badge */}
          <div className="rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-3 flex items-center gap-3">
            <Car className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="text-lg font-bold font-mono tracking-widest text-sky-900 dark:text-sky-300">{plate}</span>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">New Vehicle</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Make</label>
              <input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Toyota"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none dark:placeholder-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Corolla"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none dark:placeholder-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Color</label>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. White"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none dark:placeholder-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Type</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
              >
                <option value="car">Car</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="hatchback">Hatchback</option>
                <option value="pickup">Pickup</option>
                <option value="van">Van</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">All fields optional — staff can proceed without filling in any details.</p>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("phone")}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Back
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("confirm")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      )}

      {/* ══ STEP 3: Confirm ════════════════════════════════════════════════ */}
      {step === "confirm" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Check-In</h4>

          {/* Returning car banner */}
          {isKnownPlate && customerLookup?.customer && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Returning — {customerLookup.customer.full_name} · {customerLookup.customer.total_visits} visit{customerLookup.customer.total_visits !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Car className="h-5 w-5 text-sky-600" />
              <span className="text-xl font-bold font-mono tracking-widest text-slate-900 dark:text-white">{plate}</span>
              <span className={`ml-auto text-xs rounded-full px-2 py-0.5 font-medium ${isKnownPlate ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                {isKnownPlate ? "Returning" : "New"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-3">
              <div><span className="text-slate-500 dark:text-slate-400">Make</span><p className="font-semibold dark:text-white">{make || "—"}</p></div>
              <div><span className="text-slate-500 dark:text-slate-400">Model</span><p className="font-semibold dark:text-white">{model || "—"}</p></div>
              <div><span className="text-slate-500 dark:text-slate-400">Color</span><p className="font-semibold dark:text-white">{color || "—"}</p></div>
              <div><span className="text-slate-500 dark:text-slate-400">Type</span><p className="font-semibold capitalize dark:text-white">{vehicleType}</p></div>
              <div><span className="text-slate-500 dark:text-slate-400">Venue</span><p className="font-semibold dark:text-white">{venues.find((v) => v.id === selectedVenue)?.name || "—"}</p></div>
              <div><span className="text-slate-500 dark:text-slate-400">Phone</span><p className="font-semibold dark:text-white">{customerPhone || "—"}</p></div>
            </div>
          </div>

          {/* Venue selector — only shown if no venue auto-assigned */}
          {!selectedVenue && (
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Venue</label>
              <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-4 py-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none">
                <option value="">Select venue…</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
                ))}
              </select>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => {
              if (isKnownPlate && customerLookup?.customer?.id) {
                setStep("scan"); // skipped phone + vehicle
              } else {
                setStep(isKnownPlate ? "phone" : "vehicle"); // skipped vehicle / new plate
              }
            }}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              Back
            </button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleCheckin} disabled={checkinLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
              {checkinLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking in…</>
                : <><Send className="h-4 w-4" /> Confirm Check-In</>}
            </motion.button>
          </div>
        </div>
      )}

      {/* ══ SLOT SCREEN (post-submission) ══════════════════════════════════ */}
      {step === "slot" && checkinResult && (
        <div className="space-y-4">
          {/* Big success + slot callout */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white text-center shadow-lg"
          >
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-90" />
            <p className="text-sm font-medium opacity-80 mb-1">Vehicle Checked In</p>
            <p className="text-2xl font-black font-mono tracking-widest">{plate}</p>
          </motion.div>

          {/* Slot instruction card */}
          <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-500 mb-2">Park the vehicle at</p>
            <p className="text-5xl font-black text-sky-700">{checkinResult.session.slot?.slot_number ?? "—"}</p>
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-sky-600 font-medium">
              {checkinResult.session.slot?.floor_level && <span>Floor {checkinResult.session.slot.floor_level}</span>}
              {checkinResult.session.slot?.zone && <><span>·</span><span>Zone {checkinResult.session.slot.zone}</span></>}
              {checkinResult.session.slot?.slot_type && <><span>·</span><span className="capitalize">{checkinResult.session.slot.slot_type}</span></>}
            </div>
            <p className="mt-1 text-xs text-sky-500">{checkinResult.session.venue?.name ?? checkinResult.session.venue_name}</p>
          </div>

          {/* QR Ticket */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.1 }}
            >
              <QRCodeDisplay
                sessionId={checkinResult.session.id}
                licensePlate={plate}
                venueName={checkinResult.session.venue?.name ?? checkinResult.session.venue_name}
                entryTime={checkinResult.session.entry_time}
                slotNumber={checkinResult.session.slot?.slot_number ?? checkinResult.session.slot_number}
                size="lg"
                variant="ticket"
                showActions={true}
              />
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-2">
                Show this QR code to the customer or download and send via SMS
              </p>
            </motion.div>
          </AnimatePresence>

          {/* SMS Code card */}
          {checkinResult.session.sms_code && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">SMS Code (offline backup)</p>
              <p className="text-2xl font-bold font-mono tracking-[0.3em] text-amber-900 dark:text-amber-200">
                {checkinResult.session.sms_code}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Show this code to the valet if you can&apos;t scan the QR
              </p>
            </div>
          )}

          {/* WhatsApp button */}
          {normalizedPhone ? (
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const sess = checkinResult!.session;
                  let baseUrl = window.location.origin;
                  if (baseUrl.includes("localhost")) {
                    // Injecting Ngrok URL so WhatsApp treats it as a clickable 
                    // hyperlink instead of plain text that requires messy copy-pasting
                    baseUrl = "https://98c4-2407-d000-d-e659-1090-6c77-99cf-a170.ngrok-free.app";
                  }
                  const ticketData = {
                    sessionId: sess.id,
                    licensePlate: plate,
                    venueName: sess.venue_name || sess.venue?.name || "",
                    slotNumber: sess.slot_number || sess.slot?.slot_number || "",
                    entryTime: sess.entry_time,
                    ratePerHour: sess.rate_per_hour,
                    smsCode: sess.sms_code ?? "",
                    venuePhone: sess.venue_phone || sess.venue?.phone || undefined,
                    magicToken: sess.magic_token || undefined,
                  };
                  const link = isReturning
                    ? buildWhatsAppReturningLink(normalizedPhone, ticketData, baseUrl)
                    : buildWhatsAppTicketLink(normalizedPhone, ticketData, baseUrl);
                  window.open(link, "_blank");
                  setWhatsappSent(true);
                }}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-base font-semibold transition-colors ${whatsappSent
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {whatsappSent ? "✓ WhatsApp Opened" : "Send Ticket via WhatsApp"}
              </motion.button>
              {whatsappSent && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  WhatsApp opened — send the message to the customer.{" "}
                  <button
                    onClick={() => setWhatsappSent(false)}
                    className="text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Send again
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400">
              <MessageSquare className="h-4 w-4 shrink-0" />
              No phone number — hand the QR ticket to the customer directly
            </div>
          )}

          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep("damage")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700">
              <Camera className="h-4 w-4" /> Damage Photos
            </motion.button>
            <button onClick={() => window.print()}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              <Receipt className="h-4 w-4" /> Print
            </button>
          </div>
          <button onClick={() => setStep("done")}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
            Skip Damage Photos
          </button>
        </div>
      )}

      {/* ══ DAMAGE PHOTOS (post-slot) ══════════════════════════════════════ */}
      {step === "damage" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Damage Assessment</h4>
            <span className="text-xs bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 font-medium">Post-slot</span>
          </div>
          <p className="text-sm text-slate-500">Document any existing damage before parking. Protects both you and the customer.</p>

          <input ref={damageFileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleDamageFile} />

          {damagePhotos.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {damagePhotos.map((photo, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border border-slate-200 group">
                  <img src={photo.data} alt={photo.label} className="w-full h-32 object-cover" />
                  <button onClick={() => setDamagePhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <XCircle className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1">{photo.label}</div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => damageFileRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600">
            <Camera className="h-6 w-6" />
            <span className="font-medium">{damagePhotos.length > 0 ? "Add More Photos" : "Take / Upload Photos"}</span>
          </button>

          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Damage Notes (optional)</label>
            <textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Describe any visible damage…" rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-4 py-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none dark:placeholder-slate-400" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("slot")}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              Back
            </button>
            <motion.button whileTap={{ scale: 0.98 }}
              onClick={damagePhotos.length > 0 ? handleDamageUpload : () => setStep("done")}
              disabled={uploadingDamage}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
              {uploadingDamage
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                : damagePhotos.length > 0
                  ? <><CheckCircle2 className="h-4 w-4" /> Save {damagePhotos.length} Photo{damagePhotos.length > 1 ? "s" : ""}</>
                  : <>Done — No Damage</>}
            </motion.button>
          </div>
        </div>
      )}

      {/* ══ DONE ═══════════════════════════════════════════════════════════ */}
      {step === "done" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </motion.div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">All Done!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{plate} is parked and documented.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Plate</span>
              <span className="font-bold font-mono dark:text-white">{plate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Slot</span>
              <span className="font-bold dark:text-white">
                {checkinResult?.session?.slot?.slot_number ?? "—"}
              </span>
            </div>
            {(make || model) && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Vehicle</span>
                <span className="font-bold dark:text-white">{[color, make, model].filter(Boolean).join(" ") || "—"}</span>
              </div>
            )}
            {customerPhone && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">SMS sent to</span>
                <span className="font-bold dark:text-white">{customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Damage Photos</span>
              <span className="font-bold dark:text-white">{damageUploaded ? `${damagePhotos.length} uploaded` : "Skipped"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.98 }} onClick={resetFlow}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700">
              <Car className="h-4 w-4" /> Check-In Another
            </motion.button>
            <button onClick={onSuccess}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              Dashboard
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: Tasks (Real-time Task Queue)
// ══════════════════════════════════════════════════════════════════════════

function TasksTab({
  tasks,
  loading,
  onRefresh,
}: {
  tasks: TaskItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const activeTasks = tasks.filter((t) => t.status === "active");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <motion.div
      key="tasks"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-600">
          Your Task Queue
        </h4>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CheckCircle2 className="w-12 h-12 opacity-30 mb-2" />
          <p className="text-sm font-medium">No tasks assigned yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {activeTasks.length > 0 && (
            <div>
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600">
                Active ({activeTasks.length})
              </h5>
              <div className="space-y-3">
                {activeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div>
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                Completed Today ({completedTasks.length})
              </h5>
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function TaskCard({ task }: { task: TaskItem }) {
  return (
    <motion.div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
      variants={subtleHover}
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${task.status === "active" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"
              }`}
          >
            <Car
              className={`h-5 w-5 ${task.status === "active"
                ? "text-amber-600"
                : "text-emerald-600"
                }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold font-mono tracking-wider">
                {task.vehicle.license_plate}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${task.status === "active"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
                  }`}
              >
                {task.status === "active" ? "Active" : "Completed"}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {task.venue.name} • {task.slot.slot_number} ({task.slot.zone})
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {task.duration} •{" "}
              {new Date(task.entry_time).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        <div className="text-right">
          {task.billing?.total_amount && (
            <div className="font-bold text-emerald-600">
              Rs.{task.billing.total_amount}
            </div>
          )}
          {task.damage_photos?.length > 0 && (
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <Camera className="h-3 w-3" />
              {task.damage_photos.length} photo(s)
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: Performance
// ══════════════════════════════════════════════════════════════════════════

function PerformanceTab({ stats }: { stats: StaffStats }) {
  const metrics = [
    {
      label: "Total Tasks",
      value: String(stats.total_completed),
      trend: stats.completed_today > 0 ? `+${stats.completed_today} today` : "—",
      positive: true,
    },
    {
      label: "Active Tasks",
      value: String(stats.active_tasks),
      trend: stats.active_tasks > 0 ? "In progress" : "All clear",
      positive: stats.active_tasks === 0,
    },
    {
      label: "Today's Sessions",
      value: String(stats.completed_today),
      trend: "Completed today",
      positive: true,
    },
    {
      label: "Status",
      value: stats.active_tasks > 0 ? "Busy" : "Available",
      trend: stats.active_tasks > 0 ? `${stats.active_tasks} task(s)` : "Ready for tasks",
      positive: stats.active_tasks === 0,
    },
  ];

  return (
    <motion.div
      key="performance"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <h4 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
        Your Performance
      </h4>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
            >
              <div className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {metric.value}
                </div>
                <span
                  className={`text-sm font-medium ${metric.positive ? "text-green-600" : "text-amber-600"
                    }`}
                >
                  {metric.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 shadow-lg">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {stats.total_completed >= 5
                  ? "Great Work!"
                  : "Keep Going!"}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {stats.total_completed} total sessions handled
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: Check-Out
// Flow: search (phone/plate) → session preview → confirm → receipt
// ══════════════════════════════════════════════════════════════════════════

interface CheckoutSearchResult {
  id: string;
  entry_time: string;
  rate_per_hour: number;
  retrieval_status: string | null;
  duration: string;
  billed_hours: number;
  estimated_amount: number;
  vehicle: { license_plate: string; make: string | null; model: string | null; color: string | null; vehicle_type: string };
  slot: { slot_number: string; floor_level: string | null; zone: string | null };
  venue: { name: string };
  customer: { id: string | null; name: string | null; phone: string | null };
}

interface CheckoutReceipt {
  id: string;
  status: string;
  exit_time: string;
  duration: string;
  billed_hours: number;
  rate_per_hour: number;
  total_amount: number;
  vehicle: { license_plate: string; make: string | null; model: string | null; color: string | null };
  slot: { slot_number: string; floor_level: string | null; zone: string | null } | null;
  venue: string;
}

function CheckOutTab({ onSuccess }: { onSuccess: () => void }) {
  const [query, setQuery] = React.useState("");
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState<CheckoutSearchResult[] | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [selected, setSelected] = React.useState<CheckoutSearchResult | null>(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [receipt, setReceipt] = React.useState<CheckoutReceipt | null>(null);
  const [error, setError] = React.useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setSessions(null);
    setSelected(null);
    setNotFound(false);
    setReceipt(null);
    setError("");
    try {
      const res = await fetch(`/api/sessions/checkout/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.found && data.sessions.length > 0) {
        setSessions(data.sessions);
        if (data.sessions.length === 1) setSelected(data.sessions[0]);
      } else {
        setNotFound(true);
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selected) return;
    setCheckoutLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sessions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: selected.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setReceipt(data.session);
        onSuccess();
      } else {
        setError(data.error || "Checkout failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const reset = () => {
    setQuery("");
    setSessions(null);
    setSelected(null);
    setNotFound(false);
    setReceipt(null);
    setError("");
  };

  return (
    <motion.div
      key="checkout"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="space-y-4"
    >
      {/* ── Receipt Screen ────────────────────────────────────────────────── */}
      {receipt ? (
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white text-center shadow-lg"
          >
            <CircleCheck className="h-12 w-12 mx-auto mb-2 opacity-90" />
            <p className="text-sm font-medium opacity-80 mb-1">Checkout Complete</p>
            <p className="text-2xl font-black font-mono tracking-widest">{receipt.vehicle.license_plate}</p>
            <p className="text-sm opacity-80 mt-1">Customer has been notified</p>
          </motion.div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 text-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Receipt className="h-4 w-4 text-slate-500" />
              <span className="font-semibold dark:text-white">Receipt</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2.5">
              <span className="text-slate-500 dark:text-slate-400">Vehicle</span>
              <span className="font-bold font-mono dark:text-white">{receipt.vehicle.license_plate}</span>
              {receipt.slot?.slot_number && (
                <>
                  <span className="text-slate-500 dark:text-slate-400">Slot</span>
                  <span className="font-semibold dark:text-white">{receipt.slot.slot_number}</span>
                </>
              )}
              <span className="text-slate-500 dark:text-slate-400">Duration</span>
              <span className="font-semibold dark:text-white">{receipt.duration}</span>
              <span className="text-slate-500 dark:text-slate-400">Billed Hours</span>
              <span className="font-semibold dark:text-white">{receipt.billed_hours}h @ PKR {receipt.rate_per_hour}/hr</span>
              <span className="text-slate-500 dark:text-slate-400">Exit Time</span>
              <span className="font-semibold dark:text-white">
                {new Date(receipt.exit_time).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold pt-2 border-t border-slate-100 dark:border-slate-700">Total</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                PKR {receipt.total_amount}
              </span>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700"
          >
            <Receipt className="h-4 w-4" /> Check-Out Another
          </motion.button>
        </div>
      ) : (
        <>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Check-Out Vehicle</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">Search by customer phone number or license plate.</p>

          {/* Search bar */}
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setNotFound(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Phone (+923…) or plate (LEA-1234)"
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none dark:text-white dark:placeholder-slate-400"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSearch}
              disabled={!query.trim() || searchLoading}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </motion.button>
          </div>

          {/* Not found */}
          {notFound && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
              <Ban className="h-4 w-4 shrink-0" />
              No active parking session found for &quot;{query}&quot;
            </div>
          )}

          {/* Multiple results */}
          {sessions && sessions.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {sessions.length} sessions found — select one
              </p>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left transition ${selected?.id === s.id
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300"
                    }`}
                >
                  <span className="font-bold font-mono">{s.vehicle.license_plate}</span>
                  <span className="text-slate-500 dark:text-slate-400">{s.duration} • {s.slot.slot_number}</span>
                </button>
              ))}
            </div>
          )}

          {/* Session preview */}
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4"
            >
              {/* Vehicle header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/30 shrink-0">
                  <Car className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <div className="font-black font-mono tracking-widest text-lg dark:text-white">{selected.vehicle.license_plate}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {[selected.vehicle.color, selected.vehicle.make, selected.vehicle.model].filter(Boolean).join(" ") || selected.vehicle.vehicle_type}
                  </div>
                </div>
                {selected.retrieval_status && (
                  <span className={`ml-auto text-xs rounded-full px-2 py-0.5 font-medium ${selected.retrieval_status === "in_progress" ? "bg-amber-100 text-amber-700" :
                    selected.retrieval_status === "requested" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
                    }`}>
                    {selected.retrieval_status === "in_progress" ? "In Transit" : selected.retrieval_status}
                  </span>
                )}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Customer</span>
                <span className="font-semibold dark:text-white">{selected.customer.name || "Walk-in"}</span>
                {selected.customer.phone && (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">Phone</span>
                    <span className="font-semibold dark:text-white">{selected.customer.phone}</span>
                  </>
                )}
                <span className="text-slate-500 dark:text-slate-400">Venue</span>
                <span className="font-semibold dark:text-white">{selected.venue.name}</span>
                <span className="text-slate-500 dark:text-slate-400">Slot</span>
                <span className="font-semibold dark:text-white">{selected.slot.slot_number}{selected.slot.floor_level ? ` · F${selected.slot.floor_level}` : ""}</span>
                <span className="text-slate-500 dark:text-slate-400">Duration</span>
                <span className="font-semibold dark:text-white">{selected.duration}</span>
                <span className="text-slate-500 dark:text-slate-400">Billed</span>
                <span className="font-semibold dark:text-white">{selected.billed_hours}h × PKR {selected.rate_per_hour}</span>
              </div>

              {/* Compact QR for visual confirmation */}
              <div className="flex justify-center py-1">
                <QRCodeDisplay
                  sessionId={selected.id}
                  licensePlate={selected.vehicle.license_plate}
                  size="sm"
                  variant="compact"
                  showActions={false}
                />
              </div>

              {/* Total callout */}
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Total Amount</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">PKR {selected.estimated_amount}</span>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {checkoutLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                  : <><CircleCheck className="h-4 w-4" /> Confirm Checkout</>}
              </motion.button>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════════════════════════════════

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

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  iconColor,
}: {
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
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight dark:text-white">
            {value}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{subtext}</div>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </motion.div>
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
  intent?: "primary" | "checkout" | "neutral";
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
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${intent === "primary"
        ? "border-sky-600 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
        : intent === "checkout"
          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </motion.button>
  );
}