"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  CheckCircle2,
  Clock,
  MapPin,
  AlertCircle,
  TrendingUp,
  LogOut,
  User,
  Loader2,
  RefreshCw,
  Play,
  Square,
  Info,
  Timer,
  Car,
  Sparkles,
  Coffee,
  Sunrise,
  XCircle,
  ListChecks,
  Star,
  X,
  Camera,
  FileText,
  ChevronDown,
  Search,
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

interface WasherInfo {
  id: string;
  full_name: string;
  venue: { id: string; name: string; city: string } | null;
}

interface WashStats {
  pending: number;
  in_progress: number;
  completed_today: number;
  total_completed: number;
  avg_duration_minutes: number;
}

interface WashTask {
  id: string;
  session_id: string;
  status: string;
  wash_type: string;
  cost: number | null;
  notes: string | null;
  before_photos: string[];
  after_photos: string[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_to_name: string | null;
  vehicle: {
    id: string;
    license_plate: string;
    make: string | null;
    model: string | null;
    color: string | null;
    vehicle_type: string;
  };
  slot: {
    slot_number: string;
    floor_level: string;
    zone: string;
  } | null;
  venue: { id: string; name: string };
  customer: { name: string | null; phone: string | null };
}

// ── Shift Types ──────────────────────────────────────────────────────────

type ShiftStatus =
  | "loading"
  | "none"
  | "active"
  | "on_break"
  | "pending_approval"
  | "rejected";

interface ActiveShift {
  id: string;
  shift_start: string;
  status: "active" | "on_break" | "pending_approval" | "rejected";
  break_start?: string | null;
  total_break_minutes: number;
  is_late?: boolean;
  late_minutes?: number;
  admin_approval?: string | null;
  admin_approval_at?: string | null;
}

interface VenueShiftConfig {
  max_break_minutes: number;
  shift_start_time: string;
  shift_end_time: string;
  enforce_shift_start_window: boolean;
}

interface ShiftSummary {
  shift_start: string;
  shift_end: string;
  total_minutes: number;
  total_break_minutes: number;
  net_minutes: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmt12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${suffix}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function washTypeBadge(type: string) {
  switch (type) {
    case "basic":
      return {
        label: "Basic",
        bg: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:ring-sky-700",
      };
    case "full":
      return {
        label: "Full",
        bg: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-700",
      };
    case "premium":
      return {
        label: "Premium",
        bg: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-700",
      };
    default:
      return {
        label: type,
        bg: "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600",
      };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        bg: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-700",
        icon: <Clock className="w-3 h-3" />,
      };
    case "in_progress":
      return {
        label: "In Progress",
        bg: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:ring-sky-700",
        icon: <Droplets className="w-3 h-3" />,
      };
    case "completed":
      return {
        label: "Completed",
        bg: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-700",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    default:
      return {
        label: status,
        bg: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600",
        icon: null,
      };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── ShiftStartGate Component ────────────────────────────────────────────

function ShiftStartGate({
  staffName,
  venueName,
  venueCity,
  config,
  onStart,
  starting,
}: {
  staffName: string;
  venueName: string;
  venueCity: string;
  config: VenueShiftConfig;
  onStart: () => void;
  starting: boolean;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 pt-8 pb-6 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <Sunrise className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold leading-tight">
            {getGreeting()}, {staffName.split(" ")[0]}!
          </h2>
          <p className="text-emerald-100 text-sm mt-1">{today}</p>
        </div>

        {/* Info section */}
        <div className="px-8 py-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-medium">{venueName}</span>
            {venueCity && (
              <span className="text-slate-400">&middot; {venueCity}</span>
            )}
          </div>

          {(() => {
            const [h, m] = config.shift_start_time.split(":").map(Number);
            const deadlineMinutes = h * 60 + m + 60;
            const nowMinutes =
              new Date().getHours() * 60 + new Date().getMinutes();
            const remaining = deadlineMinutes - nowMinutes;
            const isLockedOut =
              config.enforce_shift_start_window && remaining <= 0;
            const dH = Math.floor(deadlineMinutes / 60);
            const dM = deadlineMinutes % 60;
            const deadline12 = `${dH % 12 || 12}:${String(dM).padStart(2, "0")} ${dH >= 12 ? "PM" : "AM"}`;

            return (
              <>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Standard Shift
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {fmt12(config.shift_start_time)} &ndash;{" "}
                      {fmt12(config.shift_end_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Coffee className="w-4 h-4" /> Max Break
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {config.max_break_minutes} minutes
                    </span>
                  </div>

                  {config.enforce_shift_start_window &&
                    (isLockedOut ? (
                      <div className="flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        Clock-in window closed at {deadline12}. Contact your
                        admin.
                      </div>
                    ) : remaining <= 15 ? (
                      <div className="flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        Only {remaining} min left to clock in (deadline:{" "}
                        {deadline12})
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        Clock-in deadline: {deadline12} ({remaining} min
                        remaining)
                      </div>
                    ))}
                </div>

                {isLockedOut ? (
                  <div className="space-y-3">
                    <div className="w-full py-3 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-center">
                      <p className="text-xs text-red-500 dark:text-red-400">
                        The clock-in window has passed. Your manager will be
                        notified.
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={onStart}
                      disabled={starting}
                      className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {starting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Timer className="w-5 h-5" />
                      )}
                      {starting
                        ? "Requesting..."
                        : "Clock In Late — Request Approval"}
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onStart}
                    disabled={starting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {starting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                    {starting ? "Starting..." : "Start My Shift"}
                  </motion.button>
                )}
              </>
            );
          })()}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── ShiftStatusBar Component ────────────────────────────────────────────

function ShiftStatusBar({
  shift,
  config,
  onBreakStart,
  onBreakEnd,
  onEndShift,
  actionLoading,
}: {
  shift: ActiveShift;
  config: VenueShiftConfig;
  onBreakStart: () => void;
  onBreakEnd: () => void;
  onEndShift: () => void;
  actionLoading: string | null;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  const [breakElapsed, setBreakElapsed] = React.useState(0);

  React.useEffect(() => {
    const tick = () => {
      setElapsed(
        Math.floor(
          (Date.now() - new Date(shift.shift_start).getTime()) / 1000
        )
      );
      if (shift.status === "on_break" && shift.break_start) {
        setBreakElapsed(
          Math.floor(
            (Date.now() - new Date(shift.break_start).getTime()) / 1000
          )
        );
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shift.shift_start, shift.status, shift.break_start]);

  const breakUsed =
    shift.total_break_minutes + Math.floor(breakElapsed / 60);
  const breakPct = Math.min(
    (breakUsed / config.max_break_minutes) * 100,
    100
  );
  const remainingBreakSec =
    (config.max_break_minutes - shift.total_break_minutes) * 60 -
    breakElapsed;

  const barColor =
    breakPct >= 100
      ? "bg-red-500"
      : breakPct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  const isOnBreak = shift.status === "on_break";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
                isOnBreak
                  ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-700"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-700"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                    isOnBreak ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isOnBreak ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
              </span>
              {isOnBreak ? "On Break" : "Shift Active"}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Started{" "}
              {new Date(shift.shift_start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight tabular-nums dark:text-white">
              {fmtDuration(elapsed)}
            </span>
            {isOnBreak && remainingBreakSec > 0 && (
              <span className="text-sm font-mono text-amber-600 dark:text-amber-400 font-bold">
                &middot; Break ends in{" "}
                {Math.floor(remainingBreakSec / 60)}:
                {String(remainingBreakSec % 60).padStart(2, "0")}
              </span>
            )}
            {isOnBreak && remainingBreakSec <= 0 && (
              <span className="text-sm font-semibold text-red-500">
                &middot; Break limit reached
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isOnBreak ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onBreakStart}
              disabled={
                !!actionLoading || breakUsed >= config.max_break_minutes
              }
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === "break_start" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Coffee className="w-4 h-4" />
              )}
              Take Break
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onBreakEnd}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "break_end" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              End Break
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onEndShift}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "end_shift" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            End Shift
          </motion.button>
        </div>
      </div>

      {/* Break progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            Break Used
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {Math.min(breakUsed, config.max_break_minutes)} /{" "}
            {config.max_break_minutes} min
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <motion.div
            className={`h-2 rounded-full transition-colors duration-500 ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${breakPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── CompleteModal Component ─────────────────────────────────────────────

function CompleteModal({
  task,
  notes,
  photoFiles,
  submitting,
  onNotesChange,
  onPhotosChange,
  onCancel,
  onConfirm,
}: {
  task: WashTask;
  notes: string;
  photoFiles: File[];
  submitting: boolean;
  onNotesChange: (v: string) => void;
  onPhotosChange: (files: File[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const wBadge = washTypeBadge(task.wash_type);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = React.useState<string[]>([]);

  // Keep previews in sync with photoFiles
  React.useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    onPhotosChange([...photoFiles, ...selected]);
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photoFiles.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 pt-6 pb-5 text-white shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-medium mb-1">
                Mark as Complete
              </p>
              <h2 className="text-xl font-extrabold">
                {task.vehicle.license_plate}
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ring-white/30 bg-white/20 text-white">
            <Sparkles className="w-3 h-3" />
            {wBadge.label} Wash
          </span>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              <FileText className="w-3.5 h-3.5" />
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add any notes about this wash…"
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* After Photos */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              <Camera className="w-3.5 h-3.5" />
              After Photos{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>

            {/* Previews */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 shrink-0">
                    <img
                      src={src}
                      alt={`After ${i + 1}`}
                      className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-600"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add more tile */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:text-emerald-500 transition-colors shrink-0 disabled:opacity-40"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Add more</span>
                </button>
              </div>
            )}

            {/* Empty state drop zone */}
            {previews.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 py-7 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:text-emerald-500 transition-colors disabled:opacity-40"
              >
                <Camera className="w-7 h-7" />
                <span className="text-sm font-medium">Tap to add photos</span>
                <span className="text-xs">JPG, PNG, WEBP supported</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {submitting ? "Uploading..." : "Confirm Complete"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── WashTaskCard Component ──────────────────────────────────────────────

function WashTaskCard({
  task,
  onStart,
  onComplete,
  actionLoading,
  isExpanded,
  onToggleExpand,
}: {
  task: WashTask;
  onStart: (id: string) => void;
  onComplete: (task: WashTask) => void;
  actionLoading: string | null;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}) {
  const wBadge = washTypeBadge(task.wash_type);
  const sBadge = statusBadge(task.status);
  const vehicle = task.vehicle;

  const washDurationMin =
    task.started_at && task.completed_at
      ? Math.round(
          (new Date(task.completed_at).getTime() -
            new Date(task.started_at).getTime()) /
            60000
        )
      : null;

  return (
    <motion.div
      variants={item}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
    >
      {/* Header — clickable to expand */}
      <motion.div
        variants={subtleHover}
        initial="rest"
        whileHover="hover"
        onClick={() => onToggleExpand(task.id)}
        className="flex items-start justify-between gap-3 p-5 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
            <Droplets className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white truncate">
              {vehicle.license_plate}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {[vehicle.color, vehicle.make, vehicle.model]
                .filter(Boolean)
                .join(" ") || vehicle.vehicle_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${wBadge.bg}`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            {wBadge.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${sBadge.bg}`}
          >
            {sBadge.icon}
            {sBadge.label}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400 dark:text-slate-500 ml-1"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </motion.div>

      {/* Always-visible details */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
          {task.slot && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Slot {task.slot.slot_number}
                {task.slot.zone && ` · ${task.slot.zone}`}
                {task.slot.floor_level && ` · F${task.slot.floor_level}`}
              </span>
            </div>
          )}
          {task.cost != null && (
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-slate-400" />
              <span>PKR {task.cost.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeAgo(task.created_at)}</span>
          </div>
          {task.customer.name && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{task.customer.name}</span>
            </div>
          )}
        </div>

        {task.notes && (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2 mb-3">
            {task.notes}
          </p>
        )}

        {/* Expandable details panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pb-3">
                {/* Customer details */}
                {(task.customer.name || task.customer.phone) && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Customer
                    </p>
                    <div className="space-y-1">
                      {task.customer.name && (
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                          {task.customer.name}
                        </p>
                      )}
                      {task.customer.phone && (
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {task.customer.phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Vehicle details */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Vehicle
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {vehicle.make && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Make </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{vehicle.make}</span>
                      </div>
                    )}
                    {vehicle.model && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Model </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{vehicle.model}</span>
                      </div>
                    )}
                    {vehicle.color && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Color </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{vehicle.color}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Type </span>
                      <span className="text-slate-700 dark:text-slate-200 font-medium capitalize">{vehicle.vehicle_type}</span>
                    </div>
                  </div>
                </div>

                {/* Wash duration for completed */}
                {washDurationMin !== null && (
                  <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Wash duration: {washDurationMin} min</span>
                  </div>
                )}

                {/* Before photos */}
                {task.before_photos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Before Photos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {task.before_photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={url}
                            alt={`Before ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* After photos */}
                {task.after_photos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      After Photos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {task.after_photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={url}
                            alt={`After ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {task.status === "pending" && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onStart(task.id)}
            disabled={actionLoading === task.id}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50 mb-1"
          >
            {actionLoading === task.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {actionLoading === task.id ? "Starting..." : "Start Wash"}
          </motion.button>
        )}

        {task.status === "in_progress" && (
          <div className="space-y-2">
            {task.started_at && (
              <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                <Timer className="w-3.5 h-3.5" />
                <span>
                  Started{" "}
                  {new Date(task.started_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onComplete(task)}
              disabled={actionLoading === task.id}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
            >
              {actionLoading === task.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {actionLoading === task.id ? "Completing..." : "Mark Complete"}
            </motion.button>
          </div>
        )}

        {task.status === "completed" && task.completed_at && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Completed{" "}
              {new Date(task.completed_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {task.started_at &&
                ` (${Math.round(
                  (new Date(task.completed_at).getTime() -
                    new Date(task.started_at).getTime()) /
                    60000
                )} min)`}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────

type TabKey = "tasks" | "completed" | "shift";

export default function WasherDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabKey>("tasks");
  const [washer, setWasher] = React.useState<WasherInfo | null>(null);
  const [stats, setStats] = React.useState<WashStats | null>(null);
  const [tasks, setTasks] = React.useState<WashTask[]>([]);
  const [completedTasks, setCompletedTasks] = React.useState<WashTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Shift state
  const [shiftStatus, setShiftStatus] = React.useState<ShiftStatus>("loading");
  const [activeShift, setActiveShift] = React.useState<ActiveShift | null>(
    null
  );
  const [shiftConfig, setShiftConfig] =
    React.useState<VenueShiftConfig | null>(null);
  const [shiftSummary, setShiftSummary] =
    React.useState<ShiftSummary | null>(null);
  const [shiftActionLoading, setShiftActionLoading] = React.useState<
    string | null
  >(null);
  const [shiftStarting, setShiftStarting] = React.useState(false);

  // Enhancement state
  const [completeModalTask, setCompleteModalTask] = React.useState<WashTask | null>(null);
  const [completeModalNotes, setCompleteModalNotes] = React.useState("");
  const [completeModalPhotoFiles, setCompleteModalPhotoFiles] = React.useState<File[]>([]);
  const [completeModalSubmitting, setCompleteModalSubmitting] = React.useState(false);
  const [expandedTaskId, setExpandedTaskId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [washTypeFilter, setWashTypeFilter] = React.useState<"" | "basic" | "full" | "premium">("");

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: "tasks",
      label: "My Tasks",
      icon: <Droplets className="w-4 h-4" />,
    },
    {
      key: "completed",
      label: "Completed",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      key: "shift",
      label: "Shift",
      icon: <Clock className="w-4 h-4" />,
    },
  ];

  // ── Data Fetching ──────────────────────────────────────────────────────

  const fetchWasherInfo = React.useCallback(async () => {
    try {
      const res = await fetch("/api/staff/me");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch profile");
      }
      const data = await res.json();
      if (data.staff?.role !== "washer") {
        router.push("/");
        return;
      }
      setWasher({
        id: data.staff.id,
        full_name: data.staff.full_name,
        venue: data.staff.venue,
      });
    } catch {
      setError("Failed to load profile");
    }
  }, [router]);

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/wash/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {
      // Non-critical, stats will just be empty
    }
  }, []);

  const fetchTasks = React.useCallback(async () => {
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetch("/api/wash/tasks?status=all"),
        fetch("/api/wash/tasks?status=completed"),
      ]);
      if (activeRes.ok) {
        const data = await activeRes.json();
        setTasks(
          data.tasks.filter(
            (t: WashTask) =>
              t.status === "pending" || t.status === "in_progress"
          )
        );
      }
      if (completedRes.ok) {
        const data = await completedRes.json();
        setCompletedTasks(data.tasks);
      }
    } catch {
      setError("Failed to load tasks");
    }
  }, []);

  const fetchShift = React.useCallback(async () => {
    try {
      const res = await fetch("/api/staff/shift/current");
      if (!res.ok) {
        setShiftStatus("none");
        return;
      }
      const data = await res.json();
      if (data.shift) {
        setActiveShift(data.shift);
        setShiftStatus(data.shift.status);
      } else {
        setShiftStatus("none");
      }
      if (data.venueConfig) setShiftConfig(data.venueConfig);
      if (data.summary) setShiftSummary(data.summary);
    } catch {
      setShiftStatus("none");
    }
  }, []);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchWasherInfo();
      await Promise.all([fetchStats(), fetchTasks(), fetchShift()]);
      setLoading(false);
    };
    load();
  }, [fetchWasherInfo, fetchStats, fetchTasks, fetchShift]);

  // Auto-refresh tasks every 30s
  React.useEffect(() => {
    const id = setInterval(() => {
      fetchTasks();
      fetchStats();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchTasks, fetchStats]);

  // ── Task Actions ───────────────────────────────────────────────────────

  const handleStartWash = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/wash/tasks/${taskId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start wash");
        return;
      }
      await Promise.all([fetchTasks(), fetchStats()]);
    } catch {
      setError("Failed to start wash");
    } finally {
      setActionLoading(null);
    }
  };

  // Opens modal instead of calling API directly
  const handleCompleteWash = (task: WashTask) => {
    setCompleteModalTask(task);
    setCompleteModalNotes("");
    setCompleteModalPhotoFiles([]);
  };

  // Actual API call from modal confirmation
  const handleConfirmComplete = async () => {
    if (!completeModalTask) return;
    setCompleteModalSubmitting(true);
    setActionLoading(completeModalTask.id);
    try {
      // Upload photos first if any were selected
      let afterPhotos: string[] = [];
      if (completeModalPhotoFiles.length > 0) {
        const base64List = await Promise.all(
          completeModalPhotoFiles.map(
            (file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              })
          )
        );
        const uploadRes = await fetch("/api/wash/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: base64List.map((data) => ({ data })) }),
        });
        if (!uploadRes.ok) {
          const d = await uploadRes.json();
          setError(d.error || "Failed to upload photos");
          return;
        }
        const uploadData = await uploadRes.json();
        afterPhotos = uploadData.urls ?? [];
      }

      const res = await fetch(`/api/wash/tasks/${completeModalTask.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: completeModalNotes || undefined,
          after_photos: afterPhotos.length > 0 ? afterPhotos : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to complete wash");
        return;
      }
      setCompleteModalTask(null);
      await Promise.all([fetchTasks(), fetchStats()]);
    } catch {
      setError("Failed to complete wash");
    } finally {
      setCompleteModalSubmitting(false);
      setActionLoading(null);
    }
  };

  // ── Shift Actions ──────────────────────────────────────────────────────

  const handleStartShift = async () => {
    setShiftStarting(true);
    try {
      const res = await fetch("/api/staff/shift/start", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start shift");
        return;
      }
      await fetchShift();
    } catch {
      setError("Failed to start shift");
    } finally {
      setShiftStarting(false);
    }
  };

  const handleBreakStart = async () => {
    setShiftActionLoading("break_start");
    try {
      const res = await fetch("/api/staff/shift/break/start", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start break");
        return;
      }
      await fetchShift();
    } catch {
      setError("Failed to start break");
    } finally {
      setShiftActionLoading(null);
    }
  };

  const handleBreakEnd = async () => {
    setShiftActionLoading("break_end");
    try {
      const res = await fetch("/api/staff/shift/break/end", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to end break");
        return;
      }
      await fetchShift();
    } catch {
      setError("Failed to end break");
    } finally {
      setShiftActionLoading(null);
    }
  };

  const handleEndShift = async () => {
    setShiftActionLoading("end_shift");
    try {
      const res = await fetch("/api/staff/shift/end", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to end shift");
        return;
      }
      const data = await res.json();
      if (data.summary) setShiftSummary(data.summary);
      setShiftStatus("none");
      setActiveShift(null);
    } catch {
      setError("Failed to end shift");
    } finally {
      setShiftActionLoading(null);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // ── Derived / Memos ────────────────────────────────────────────────────

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.vehicle.license_plate.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = !washTypeFilter || t.wash_type === washTypeFilter;
      return matchSearch && matchType;
    });
  }, [tasks, searchQuery, washTypeFilter]);

  const todayEarnings = React.useMemo(() => {
    const today = new Date().toLocaleDateString();
    return completedTasks
      .filter(
        (t) =>
          t.completed_at &&
          new Date(t.completed_at).toLocaleDateString() === today
      )
      .reduce((s, t) => s + (t.cost ?? 0), 0);
  }, [completedTasks]);

  const filteredActiveTasks = filteredTasks.filter((t) => t.status === "in_progress");
  const filteredPendingTasks = filteredTasks.filter((t) => t.status === "pending");

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Loading dashboard...
          </p>
        </motion.div>
      </div>
    );
  }

  // Shift gate — must clock in before seeing tasks
  if (
    shiftStatus === "none" &&
    washer &&
    shiftConfig
  ) {
    return (
      <ShiftStartGate
        staffName={washer.full_name}
        venueName={washer.venue?.name || "Unknown Venue"}
        venueCity={washer.venue?.city || ""}
        config={shiftConfig}
        onStart={handleStartShift}
        starting={shiftStarting}
      />
    );
  }

  // Pending approval gate
  if (shiftStatus === "pending_approval" && activeShift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold dark:text-white">
            Awaiting Approval
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your late clock-in requires admin approval. You&apos;ll be able to
            access your tasks once approved.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={fetchShift}
            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Check Status
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold dark:text-white leading-tight">
                Washer Dashboard
              </h1>
              {washer && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {washer.full_name}
                  {washer.venue && ` · ${washer.venue.name}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shift status bar */}
        {activeShift &&
          shiftConfig &&
          (shiftStatus === "active" || shiftStatus === "on_break") && (
            <ShiftStatusBar
              shift={activeShift}
              config={shiftConfig}
              onBreakStart={handleBreakStart}
              onBreakEnd={handleBreakEnd}
              onEndShift={handleEndShift}
              actionLoading={shiftActionLoading}
            />
          )}

        {/* Stats row */}
        {stats && (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6"
          >
            {[
              {
                label: "In Progress",
                value: stats.in_progress,
                icon: <Droplets className="w-4 h-4" />,
                color: "text-sky-600 dark:text-sky-400",
                bg: "bg-sky-50 dark:bg-sky-900/20",
              },
              {
                label: "Pending",
                value: stats.pending,
                icon: <Clock className="w-4 h-4" />,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-50 dark:bg-amber-900/20",
              },
              {
                label: "Today",
                value: stats.completed_today,
                icon: <CheckCircle2 className="w-4 h-4" />,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
              },
              {
                label: "Avg Time",
                value: `${stats.avg_duration_minutes}m`,
                icon: <Timer className="w-4 h-4" />,
                color: "text-violet-600 dark:text-violet-400",
                bg: "bg-violet-50 dark:bg-violet-900/20",
              },
              {
                label: "Today's Earnings",
                value: `PKR ${todayEarnings.toLocaleString()}`,
                icon: <TrendingUp className="w-4 h-4" />,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
              },
            ].map((s) => (
              <motion.div
                key={s.label}
                variants={item}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}
                  >
                    {s.icon}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {s.label}
                  </span>
                </div>
                <p className="text-xl font-extrabold tracking-tight dark:text-white">
                  {s.value}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === "tasks" && tasks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                  {tasks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Search + filter bar */}
              <div className="mb-5 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by plate number…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["", "basic", "full", "premium"] as const).map((type) => {
                    const badge = type ? washTypeBadge(type) : null;
                    const isActive = washTypeFilter === type;
                    return (
                      <button
                        key={type || "all"}
                        onClick={() => setWashTypeFilter(type)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset transition-all ${
                          isActive
                            ? badge
                              ? badge.bg
                              : "bg-slate-800 text-white ring-slate-700 dark:bg-white dark:text-slate-900 dark:ring-slate-200"
                            : "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600 hover:ring-slate-300"
                        }`}
                      >
                        {type ? washTypeBadge(type).label : "All"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* No match message */}
              {filteredTasks.length === 0 && tasks.length > 0 && (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  No tasks match your filters.{" "}
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setWashTypeFilter("");
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {/* In-progress section */}
              {filteredActiveTasks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-sky-500" />
                    In Progress ({filteredActiveTasks.length})
                  </h3>
                  <div className="space-y-3">
                    {filteredActiveTasks.map((task) => (
                      <WashTaskCard
                        key={task.id}
                        task={task}
                        onStart={handleStartWash}
                        onComplete={handleCompleteWash}
                        actionLoading={actionLoading}
                        isExpanded={expandedTaskId === task.id}
                        onToggleExpand={(id) =>
                          setExpandedTaskId((p) => (p === id ? null : id))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending section */}
              {filteredPendingTasks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Pending ({filteredPendingTasks.length})
                  </h3>
                  <div className="space-y-3">
                    {filteredPendingTasks.map((task) => (
                      <WashTaskCard
                        key={task.id}
                        task={task}
                        onStart={handleStartWash}
                        onComplete={handleCompleteWash}
                        actionLoading={actionLoading}
                        isExpanded={expandedTaskId === task.id}
                        onToggleExpand={(id) =>
                          setExpandedTaskId((p) => (p === id ? null : id))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {tasks.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-400 dark:text-slate-500 mb-1">
                    No tasks right now
                  </h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    New wash requests will appear here automatically.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      fetchTasks();
                      fetchStats();
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {stats && (
                <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                    Performance Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {stats.completed_today}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Today
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                        {stats.total_completed}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        All Time
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
                        {stats.avg_duration_minutes}m
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Avg Duration
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Wash type breakdown */}
              {completedTasks.length > 0 && (() => {
                const breakdown = (["basic", "full", "premium"] as const)
                  .map((type) => ({
                    type,
                    badge: washTypeBadge(type),
                    count: completedTasks.filter((t) => t.wash_type === type).length,
                    revenue: completedTasks
                      .filter((t) => t.wash_type === type)
                      .reduce((s, t) => s + (t.cost ?? 0), 0),
                  }))
                  .filter((b) => b.count > 0);

                return breakdown.length > 0 ? (
                  <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                      By Wash Type
                    </h3>
                    <div className="space-y-2">
                      {breakdown.map((b) => (
                        <div key={b.type} className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${b.badge.bg}`}
                          >
                            <Sparkles className="w-3 h-3" />
                            {b.badge.label}
                          </span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              {b.count} wash{b.count !== 1 ? "es" : ""}
                            </span>
                            {b.revenue > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                PKR {b.revenue.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {completedTasks.length > 0 ? (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <WashTaskCard
                      key={task.id}
                      task={task}
                      onStart={handleStartWash}
                      onComplete={handleCompleteWash}
                      actionLoading={actionLoading}
                      isExpanded={expandedTaskId === task.id}
                      onToggleExpand={(id) =>
                        setExpandedTaskId((p) => (p === id ? null : id))
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <ListChecks className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-400 dark:text-slate-500 mb-1">
                    No completed washes yet
                  </h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Completed wash tasks will appear here.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "shift" && (
            <motion.div
              key="shift"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Active shift — live timer + break/end controls */}
              {activeShift && shiftConfig && (
                <ShiftStatusBar
                  shift={activeShift}
                  config={shiftConfig}
                  onBreakStart={handleBreakStart}
                  onBreakEnd={handleBreakEnd}
                  onEndShift={handleEndShift}
                  actionLoading={shiftActionLoading}
                />
              )}

              {/* No shift yet — start shift button */}
              {!activeShift && shiftConfig && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
                    <Sunrise className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white mb-1">
                      Ready to Start?
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Scheduled{" "}
                      {fmt12(shiftConfig.shift_start_time)} &ndash;{" "}
                      {fmt12(shiftConfig.shift_end_time)}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleStartShift}
                    disabled={shiftStarting}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {shiftStarting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {shiftStarting ? "Starting..." : "Start My Shift"}
                  </motion.button>
                </div>
              )}

              {/* Shift summary (shown after ending) */}
              {shiftSummary && !activeShift && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                    Last Shift Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Total Time</p>
                      <p className="font-semibold dark:text-white">{fmtMinutes(shiftSummary.total_minutes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Net Work Time</p>
                      <p className="font-semibold dark:text-white">{fmtMinutes(shiftSummary.net_minutes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Break Time</p>
                      <p className="font-semibold dark:text-white">{fmtMinutes(shiftSummary.total_break_minutes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Shift Period</p>
                      <p className="font-semibold dark:text-white">
                        {new Date(shiftSummary.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" "}&ndash;{" "}
                        {new Date(shiftSummary.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Task Completion Modal */}
      <AnimatePresence>
        {completeModalTask && (
          <CompleteModal
            task={completeModalTask}
            notes={completeModalNotes}
            photoFiles={completeModalPhotoFiles}
            submitting={completeModalSubmitting}
            onNotesChange={setCompleteModalNotes}
            onPhotosChange={setCompleteModalPhotoFiles}
            onCancel={() => setCompleteModalTask(null)}
            onConfirm={handleConfirmComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
