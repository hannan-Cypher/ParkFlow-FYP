import { motion, AnimatePresence } from "framer-motion";
import {
    Sunrise, MapPin, Clock, Coffee, XCircle, Info, Loader2, Play, Timer, Square, CheckCircle2, TrendingUp
} from "lucide-react";
import React from "react";

// ── Types ────────────────────────────────────────────────────────────────

export type ShiftStatus = "loading" | "none" | "active" | "on_break" | "pending_approval" | "rejected";

export interface ActiveShift {
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

export interface VenueShiftConfig {
    max_break_minutes: number;
    shift_start_time: string; // "09:00"
    shift_end_time: string;   // "18:00"
    enforce_shift_start_window: boolean;
}

export interface ShiftSummary {
    shift_start: string;
    shift_end: string;
    total_minutes: number;
    total_break_minutes: number;
    net_minutes: number;
}

// ── Helper functions ──────────────────────────────────────────────────────

export function fmtDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function fmtMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export function fmt12(time24: string): string {
    const [hStr, mStr] = time24.split(":");
    const h = parseInt(hStr, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mStr} ${suffix}`;
}

export function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
}

// ── Components ────────────────────────────────────────────────────────────

export function ShiftStartGate({
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
                <div className="bg-gradient-to-br from-sky-500 to-blue-600 px-8 pt-8 pb-6 text-white">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                        <Sunrise className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold leading-tight">
                        {getGreeting()}, {staffName.split(" ")[0]}!
                    </h2>
                    <p className="text-sky-100 text-sm mt-1">{today}</p>
                </div>

                <div className="px-8 py-6 space-y-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                        <MapPin className="w-4 h-4 text-sky-500 shrink-0" />
                        <span className="font-medium">{venueName}</span>
                        {venueCity && <span className="text-slate-400">· {venueCity}</span>}
                    </div>

                    {(() => {
                        const [h, m] = config.shift_start_time.split(":").map(Number);
                        const deadlineMinutes = h * 60 + m + 60;
                        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                        const remaining = deadlineMinutes - nowMinutes;
                        const isLockedOut = config.enforce_shift_start_window && remaining <= 0;
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
                                            {fmt12(config.shift_start_time)} – {fmt12(config.shift_end_time)}
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

                                    {config.enforce_shift_start_window && (
                                        isLockedOut ? (
                                            <div className="flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                                Clock-in window closed at {deadline12}. Contact your admin.
                                            </div>
                                        ) : remaining <= 15 ? (
                                            <div className="flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                                <Info className="w-3.5 h-3.5 shrink-0" />
                                                Only {remaining} min left to clock in (deadline: {deadline12})
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-2 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                                <Info className="w-3.5 h-3.5 shrink-0" />
                                                Clock-in deadline: {deadline12} ({remaining} min remaining)
                                            </div>
                                        )
                                    )}
                                </div>

                                {isLockedOut ? (
                                    <div className="space-y-3">
                                        <div className="w-full py-3 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-center">
                                            <p className="text-xs text-red-500 dark:text-red-400">
                                                The clock-in window has passed. Your manager will be notified.
                                            </p>
                                        </div>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={onStart}
                                            disabled={starting}
                                            className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Timer className="w-5 h-5" />}
                                            {starting ? "Requesting…" : "Clock In Late — Request Approval"}
                                        </motion.button>
                                    </div>
                                ) : (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={onStart}
                                        disabled={starting}
                                        className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                        {starting ? "Starting…" : "Start My Shift"}
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

export function ShiftStatusBar({
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
            setElapsed(Math.floor((Date.now() - new Date(shift.shift_start).getTime()) / 1000));
            if (shift.status === "on_break" && shift.break_start) {
                setBreakElapsed(Math.floor((Date.now() - new Date(shift.break_start).getTime()) / 1000));
            }
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [shift.shift_start, shift.status, shift.break_start]);

    const breakUsed = shift.total_break_minutes + Math.floor(breakElapsed / 60);
    const breakPct = Math.min((breakUsed / config.max_break_minutes) * 100, 100);
    const remainingBreakSec =
        (config.max_break_minutes - shift.total_break_minutes) * 60 - breakElapsed;

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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${isOnBreak
                                ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-700"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-700"
                                }`}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${isOnBreak ? "bg-amber-400" : "bg-emerald-400"}`} />
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnBreak ? "bg-amber-500" : "bg-emerald-500"}`} />
                            </span>
                            {isOnBreak ? "On Break" : "Shift Active"}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                            Started {new Date(shift.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold tracking-tight tabular-nums dark:text-white">
                            {fmtDuration(elapsed)}
                        </span>
                        {isOnBreak && remainingBreakSec > 0 && (
                            <span className="text-sm font-mono text-amber-600 dark:text-amber-400 font-bold">
                                · Break ends in{" "}
                                {Math.floor(remainingBreakSec / 60)}:{String(remainingBreakSec % 60).padStart(2, "0")}
                            </span>
                        )}
                        {isOnBreak && remainingBreakSec <= 0 && (
                            <span className="text-sm font-semibold text-red-500">· Break limit reached</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {!isOnBreak ? (
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onBreakStart}
                            disabled={!!actionLoading || breakUsed >= config.max_break_minutes}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {actionLoading === "break_start" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
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
                            {actionLoading === "break_end" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
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
                        {actionLoading === "end_shift" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                        End Shift
                    </motion.button>
                </div>
            </div>

            <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        Break Used
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {Math.min(breakUsed, config.max_break_minutes)} / {config.max_break_minutes} min
                    </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <motion.div
                        className={`h-2 rounded-full transition-colors duration-500 ${barColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${breakPct}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>
        </motion.div>
    );
}

export function ShiftSummaryModal({
    summary,
    staffName,
    onDone,
}: {
    summary: ShiftSummary;
    staffName: string;
    onDone: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 pt-8 pb-6 text-white text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-extrabold">Shift Complete!</h2>
                    <p className="text-emerald-100 text-sm mt-1">Great work today, {staffName.split(" ")[0]}!</p>
                </div>

                <div className="px-8 py-6 space-y-3">
                    {[
                        { label: "Total Time", value: fmtMinutes(summary.total_minutes), icon: Clock },
                        { label: "Break Taken", value: fmtMinutes(summary.total_break_minutes), icon: Coffee },
                        { label: "Net Worked", value: fmtMinutes(summary.net_minutes), icon: TrendingUp },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2 text-sm">
                                <Icon className="w-4 h-4" />
                                {label}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-white">{value}</span>
                        </div>
                    ))}

                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onDone}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all text-sm"
                    >
                        Done
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}
