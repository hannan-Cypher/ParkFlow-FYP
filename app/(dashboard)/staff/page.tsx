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
  Phone,
  MessageSquare,
  Star,
  ArrowRight,
} from "lucide-react";
import DarkModeToggle from "@/components/DarkModeToggle";

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
}

interface VenueOption {
  id: string;
  name: string;
  city: string;
}

// ── Tabs ─────────────────────────────────────────────────────────────────
const tabs = ["Active Vehicles", "Check-In", "Tasks", "Performance"] as const;
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
      className="mx-auto max-w-6xl px-4 pb-24 pt-10 text-slate-800 dark:text-slate-100 min-h-screen"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Dark Mode Background */}
      <div className="fixed inset-0 -z-10 bg-slate-50 dark:bg-slate-900 transition-colors duration-300" />
      {/* Header */}
      <motion.header
        variants={item}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Valet Staff
              </span>
            </div>
            {staffInfo?.venue && (
              <div className="flex items-center space-x-1 bg-sky-50 dark:bg-sky-900/30 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800">
                <MapPin className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span className="text-sm font-medium text-sky-700 dark:text-sky-300">
                  {staffInfo.venue.name}
                </span>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-white">
            Staff Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {staffInfo?.full_name || "Valet Attendant"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DarkModeToggle />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isLoggingOut ? "Logging out..." : "Logout"}
            </span>
          </motion.button>
        </div>
      </motion.header>

      {/* Stats */}
      <motion.section
        variants={item}
        className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickAction
            icon={Car}
            label="Check-in Vehicle"
            intent="primary"
            onClick={() => setActiveTab("Check-In")}
          />
          <QuickAction
            icon={ParkingCircle}
            label="View Active Vehicles"
            onClick={() => setActiveTab("Active Vehicles")}
          />
          <QuickAction
            icon={AlertCircle}
            label="View Task Queue"
            onClick={() => setActiveTab("Tasks")}
          />
        </div>
      </motion.section>

      {/* Tabs */}
      <motion.nav variants={item} className="mt-6">
        <div className="relative flex items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`relative w-full rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === t
                ? "bg-white dark:bg-slate-700 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
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
            <ActiveVehiclesTab
              vehicles={activeVehicles}
              loading={loadingVehicles}
              onRefresh={fetchActiveVehicles}
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
}: {
  vehicles: ActiveSession[];
  loading: boolean;
  onRefresh: () => void;
}) {
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
              className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
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
                  <div className="font-bold font-mono tracking-wider">
                    {(v.vehicle as { license_plate: string }).license_plate}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.customer_name} •{" "}
                    {new Date(v.entry_time).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <MapPin className="h-3 w-3" />
                    {(v.slot as { slot_number: string }).slot_number}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{v.duration}</div>
              </div>
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
  | "details"
  | "confirm"
  | "slot"
  | "damage"
  | "done";

interface CustomerLookup {
  found: boolean;
  customer?: {
    id: string;
    full_name: string;
    phone: string;
    session_count: number;
    last_visit: string | null;
    vehicles: Array<{
      id: string;
      license_plate: string;
      make: string | null;
      model: string | null;
      color: string | null;
      vehicle_type: string;
    }>;
  };
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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Step 2 — Phone lookup
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [customerLookup, setCustomerLookup] = React.useState<CustomerLookup | null>(null);

  // Step 3 — Vehicle details
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [color, setColor] = React.useState("");
  const [vehicleType, setVehicleType] = React.useState("car");
  const [venues, setVenues] = React.useState<VenueOption[]>([]);
  const [selectedVenue, setSelectedVenue] = React.useState(staffVenue?.id || "");

  // Submit / result
  const [checkinLoading, setCheckinLoading] = React.useState(false);
  const [checkinResult, setCheckinResult] = React.useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [smsSent, setSmsSent] = React.useState(false);

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

  // ── Phone lookup ────────────────────────────────────────────────────────
  const handlePhoneLookup = React.useCallback(async () => {
    const phone = customerPhone.trim();
    if (!phone) return;
    setLookupLoading(true);
    setCustomerLookup(null);
    try {
      const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
      const data: CustomerLookup = await res.json();
      setCustomerLookup(data);
      // If returning customer with vehicle matching detected plate, pre-fill details
      if (data.found && data.customer) {
        const matchingVehicle = data.customer.vehicles.find(
          (v) => v.license_plate === plate
        );
        if (matchingVehicle) {
          if (matchingVehicle.make) setMake(matchingVehicle.make);
          if (matchingVehicle.model) setModel(matchingVehicle.model);
          if (matchingVehicle.color) setColor(matchingVehicle.color);
          setVehicleType(matchingVehicle.vehicle_type || "car");
        }
      }
    } catch { console.error("Phone lookup failed"); }
    finally { setLookupLoading(false); }
  }, [customerPhone, plate]);

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

      // Fire SMS stub if phone was entered
      if (customerPhone && data.session?.id) {
        fetch("/api/notify/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: customerPhone, session_id: data.session.id }),
        })
          .then(() => setSmsSent(true))
          .catch(console.error);
      }

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
    const sessionId = (checkinResult?.session as Record<string, unknown>)?.id as string;
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
    setStep("scan"); setPlate(""); setAnprImage(null); setErrorMsg("");
    setCustomerPhone(""); setCustomerLookup(null); setSmsSent(false);
    setMake(""); setModel(""); setColor(""); setVehicleType("car");
    setCheckinResult(null); setDamagePhotos([]); setDamageNotes("");
    setDamageUploaded(false); stopCamera();
  };

  // ── Progress bar (steps 1-4 only, pre-submission) ───────────────────────
  const PRE_STEPS: CheckInStep[] = ["scan", "phone", "details", "confirm"];
  const stepIdx = PRE_STEPS.indexOf(step);
  const STEP_LABELS = ["Scan", "Customer", "Details", "Confirm"];

  return (
    <motion.div
      key="checkin"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      {/* Progress bar — only during pre-submission steps */}
      {["scan", "phone", "details", "confirm"].includes(step) && (
        <div className="mb-6 flex items-center justify-center gap-1">
          {PRE_STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    i < stepIdx
                      ? "bg-emerald-500 text-white"
                      : i === stepIdx
                      ? "bg-sky-600 text-white shadow-md ring-2 ring-sky-300"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {i < stepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i === stepIdx ? "text-sky-600" : "text-slate-400"}`}>
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < 3 && (
                <div className={`mb-4 h-0.5 w-8 transition-all ${i < stepIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ══ STEP 1: ANPR Scan ══════════════════════════════════════════════ */}
      {step === "scan" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step 1 — Scan License Plate</h4>
          <p className="text-sm text-slate-500">Upload a photo or use the camera to auto-detect the plate.</p>

          <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button onClick={() => { stopCamera(); setAnprImage(null); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-white shadow-sm ring-1 ring-slate-200 text-slate-900">
              <Upload className="h-4 w-4" /> Upload Image
            </button>
            <button onClick={startCamera}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700">
              <Camera className="h-4 w-4" /> Use Camera
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

          {!cameraActive && !anprImage && (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-12 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600">
              <ImageIcon className="h-10 w-10" />
              <p className="font-medium">Click to upload plate image</p>
              <p className="text-xs text-slate-400">JPG, PNG, WEBP</p>
            </button>
          )}

          {cameraActive && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
                <video ref={videoRef} className="w-full" playsInline muted autoPlay />
                <div className="absolute inset-0 pointer-events-none border-2 border-sky-400/50 rounded-2xl" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.98 }} onClick={captureAndDetect}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700">
                  <ScanLine className="h-4 w-4" /> Capture & Detect
                </motion.button>
                <button onClick={stopCamera} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {anprImage && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200">
              <img src={anprImage} alt="Plate" className="w-full object-contain max-h-48" />
              <button onClick={() => setAnprImage(null)}
                className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white">
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
            <label className="text-sm font-semibold text-slate-700">License Plate</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="e.g., LEA-1234"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-mono font-bold tracking-widest text-center focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" />
          </div>

          <motion.button whileTap={{ scale: 0.98 }} onClick={() => plate && setStep("phone")} disabled={!plate}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
            Next: Customer Info <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      )}

      {/* ══ STEP 2: Customer Phone ══════════════════════════════════════════ */}
      {step === "phone" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step 2 — Customer Phone</h4>
          <p className="text-sm text-slate-500">Ask the customer for their phone number to send the QR code and identify returning customers.</p>

          {/* Plate badge */}
          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 flex items-center gap-3">
            <Car className="h-5 w-5 text-sky-600 shrink-0" />
            <span className="text-lg font-bold font-mono tracking-widest text-sky-900">{plate}</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Phone Number</label>
            <div className="flex gap-2">
              <input
                value={customerPhone}
                onChange={(e) => { setCustomerPhone(e.target.value); setCustomerLookup(null); }}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
                placeholder="+92 300 1234567"
                type="tel"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
              />
              <motion.button whileTap={{ scale: 0.97 }} onClick={handlePhoneLookup} disabled={!customerPhone.trim() || lookupLoading}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {lookupLoading ? "" : "Lookup"}
              </motion.button>
            </div>
          </div>

          {/* Lookup result */}
          {customerLookup && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 space-y-2 ${customerLookup.found ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              {customerLookup.found && customerLookup.customer ? (
                <>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">Returning Customer</span>
                    <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                      {customerLookup.customer.session_count} visit{customerLookup.customer.session_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-emerald-900">{customerLookup.customer.full_name}</p>
                  {customerLookup.customer.last_visit && (
                    <p className="text-xs text-emerald-700">
                      Last visit: {new Date(customerLookup.customer.last_visit).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {customerLookup.customer.vehicles.some((v) => v.license_plate === plate) && (
                    <p className="text-xs text-emerald-600 font-medium">✓ Vehicle {plate} recognised — details pre-filled</p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Walk-in customer — no account found for this number</span>
                </div>
              )}
            </motion.div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep("scan")}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Back
            </button>
            <motion.button whileTap={{ scale: 0.98 }}
              onClick={() => setStep("details")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700">
              {customerPhone.trim() ? "Next: Vehicle Details" : "Skip →"} <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      )}

      {/* ══ STEP 3: Vehicle Details ═════════════════════════════════════════ */}
      {step === "details" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step 3 — Vehicle Details</h4>

          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 flex items-center gap-3">
            <Car className="h-5 w-5 text-sky-600 shrink-0" />
            <span className="text-lg font-bold font-mono tracking-widest text-sky-900">{plate}</span>
            {customerLookup?.found && (
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                <Star className="h-3 w-3" /> Returning
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">Make</label>
              <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Toyota"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Corolla"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Color</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. White"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Type</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none">
                {["car", "sedan", "suv", "hatchback", "pickup", "van"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Venue</label>
            <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none">
              <option value="">Select venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("phone")}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Back
            </button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => selectedVenue && setStep("confirm")} disabled={!selectedVenue}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50">
              Review & Confirm <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      )}

      {/* ══ STEP 4: Confirm ════════════════════════════════════════════════ */}
      {step === "confirm" && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Step 4 — Review & Confirm</h4>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <Car className="h-5 w-5 text-sky-600" />
              <span className="text-xl font-bold font-mono tracking-widest">{plate}</span>
              {customerLookup?.found && (
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                  ★ {customerLookup.customer?.full_name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-y-3">
              <div><span className="text-slate-500">Make</span><p className="font-semibold">{make || "—"}</p></div>
              <div><span className="text-slate-500">Model</span><p className="font-semibold">{model || "—"}</p></div>
              <div><span className="text-slate-500">Color</span><p className="font-semibold">{color || "—"}</p></div>
              <div><span className="text-slate-500">Type</span><p className="font-semibold capitalize">{vehicleType}</p></div>
              <div><span className="text-slate-500">Venue</span><p className="font-semibold">{venues.find((v) => v.id === selectedVenue)?.name || "—"}</p></div>
              <div><span className="text-slate-500">Customer Phone</span><p className="font-semibold">{customerPhone || "—"}</p></div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep("details")}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
            <p className="text-5xl font-black text-sky-700">
              {(checkinResult.session as Record<string, unknown>)?.slot
                ? ((checkinResult.session as Record<string, unknown>).slot as Record<string, string>).slot_number
                : "—"}
            </p>
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-sky-600 font-medium">
              {((checkinResult.session as Record<string, unknown>)?.slot as Record<string, string>)?.floor_level && (
                <span>Floor {((checkinResult.session as Record<string, unknown>).slot as Record<string, string>).floor_level}</span>
              )}
              {((checkinResult.session as Record<string, unknown>)?.slot as Record<string, string>)?.zone && (
                <><span>·</span><span>Zone {((checkinResult.session as Record<string, unknown>).slot as Record<string, string>).zone}</span></>
              )}
              {((checkinResult.session as Record<string, unknown>)?.slot as Record<string, string>)?.slot_type && (
                <><span>·</span><span className="capitalize">{((checkinResult.session as Record<string, unknown>).slot as Record<string, string>).slot_type}</span></>
              )}
            </div>
            <p className="mt-1 text-xs text-sky-500">
              {(checkinResult.session as Record<string, unknown>)?.venue
                ? ((checkinResult.session as Record<string, unknown>).venue as Record<string, string>).name
                : ""}
            </p>
          </div>

          {/* SMS confirmation */}
          {customerPhone && (
            <div className={`flex items-center gap-3 p-3 rounded-xl text-sm ${smsSent ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-slate-50 border border-slate-200 text-slate-500"}`}>
              <MessageSquare className="h-4 w-4 shrink-0" />
              {smsSent
                ? `SMS with slot info sent to ${customerPhone}`
                : `Sending SMS to ${customerPhone}…`}
            </div>
          )}

          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep("damage")}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700">
            <Camera className="h-4 w-4" /> Take Damage Photos <ArrowRight className="h-4 w-4" />
          </motion.button>
          <button onClick={() => setStep("done")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50">
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
            <label className="text-sm font-semibold text-slate-700">Damage Notes (optional)</label>
            <textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Describe any visible damage…" rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("slot")}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
            <h3 className="text-xl font-bold text-slate-900">All Done!</h3>
            <p className="text-sm text-slate-500 mt-1">{plate} is parked and documented.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Plate</span>
              <span className="font-bold font-mono">{plate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Slot</span>
              <span className="font-bold">
                {(checkinResult?.session as Record<string, unknown>)?.slot
                  ? ((checkinResult!.session as Record<string, unknown>).slot as Record<string, string>).slot_number
                  : "—"}
              </span>
            </div>
            {(make || model) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle</span>
                <span className="font-bold">{[color, make, model].filter(Boolean).join(" ") || "—"}</span>
              </div>
            )}
            {customerPhone && (
              <div className="flex justify-between">
                <span className="text-slate-500">SMS sent to</span>
                <span className="font-bold">{customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Damage Photos</span>
              <span className="font-bold">{damageUploaded ? `${damagePhotos.length} uploaded` : "Skipped"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.98 }} onClick={resetFlow}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700">
              <Car className="h-4 w-4" /> Check-In Another
            </motion.button>
            <button onClick={onSuccess}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
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
      className="rounded-2xl border border-slate-200 bg-white p-4"
      variants={subtleHover}
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${task.status === "active" ? "bg-amber-50" : "bg-emerald-50"
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
            <div className="text-xs text-slate-500 mt-0.5">
              {task.venue.name} • {task.slot.slot_number} ({task.slot.zone})
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
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
      <h4 className="mb-3 text-sm font-semibold text-slate-600">
        Your Performance
      </h4>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="text-sm text-slate-500">{metric.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-3xl font-bold tracking-tight">
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

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-blue-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 shadow-lg">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">
                {stats.total_completed >= 5
                  ? "Great Work!"
                  : "Keep Going!"}
              </div>
              <div className="text-sm text-slate-600">
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
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${intent === "primary"
        ? "border-sky-600 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </motion.button>
  );
}