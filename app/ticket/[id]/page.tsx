"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Car, CheckCircle2, Loader2, AlertCircle, ParkingCircle } from "lucide-react";
import QRCodeDisplay from "@/components/shared/QRCodeDisplay";

interface TicketSession {
  id: string;
  entry_time: string;
  exit_time: string | null;
  status: string;
  qr_code: string;
  rate_per_hour: number;
  total_hours: number | null;
  total_amount: number | null;
  retrieval_status: string | null;
  license_plate: string;
  make: string | null;
  model: string | null;
  color: string | null;
  venue_name: string;
  venue_address: string | null;
  slot_number: string | null;
  floor_level: string | null;
  zone: string | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const formatDuration = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function StatusBadge({ status, retrieval }: { status: string; retrieval: string | null }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
      </span>
    );
  }
  if (retrieval === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <motion.span
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-blue-500 inline-block"
        />
        Retrieval In Progress
      </span>
    );
  }
  if (retrieval === "requested") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <motion.span
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-amber-500 inline-block"
        />
        Retrieval Requested
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      <motion.span
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-2 h-2 rounded-full bg-emerald-500 inline-block"
      />
      Active
    </span>
  );
}

export default function TicketPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<TicketSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalRequested, setRetrievalRequested] = useState(false);
  const [retrievalError, setRetrievalError] = useState("");

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/ticket/${params.id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setSession(data.session);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [params.id]);

  const handleRequestRetrieval = async () => {
    if (!session) return;
    setRetrievalLoading(true);
    setRetrievalError("");
    try {
      const res = await fetch("/api/public/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          license_plate: session.license_plate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRetrievalRequested(true);
        setSession((prev) => prev ? { ...prev, retrieval_status: "requested" } : prev);
      } else {
        setRetrievalError(data.error || "Failed to request retrieval");
      }
    } catch {
      setRetrievalError("Network error. Please try again.");
    } finally {
      setRetrievalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Ticket not found</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This QR code may be invalid or expired.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Contact the venue staff for assistance.
          </p>
        </div>
      </div>
    );
  }

  const isActive = session.status === "active";
  const isCompleted = session.status === "completed";
  const canRequestRetrieval =
    isActive &&
    !session.retrieval_status &&
    !retrievalRequested;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Brand header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <ParkingCircle className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-zinc-900 dark:text-white">ParkFlow</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <StatusBadge status={session.status} retrieval={session.retrieval_status} />
        </motion.div>

        {/* QR code (compact — they already have the physical QR) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex justify-center"
        >
          <QRCodeDisplay
            sessionId={session.id}
            licensePlate={session.license_plate}
            venueName={session.venue_name}
            size="md"
            variant="compact"
            showActions={false}
          />
        </motion.div>

        {/* Session details card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
        >
          <div className="grid divide-y divide-zinc-100 dark:divide-zinc-800">
            <Row icon={<MapPin className="w-4 h-4 text-zinc-400" />} label="Venue" value={session.venue_name} />
            {session.slot_number && (
              <Row
                icon={<Car className="w-4 h-4 text-zinc-400" />}
                label="Slot"
                value={`${session.slot_number}${session.floor_level ? `, Floor ${session.floor_level}` : ""}${session.zone ? ` · ${session.zone}` : ""}`}
              />
            )}
            <Row
              icon={<Clock className="w-4 h-4 text-zinc-400" />}
              label="Entered"
              value={formatTime(session.entry_time)}
            />
            <Row
              icon={<Car className="w-4 h-4 text-zinc-400" />}
              label="Rate"
              value={`PKR ${session.rate_per_hour}/hr`}
            />
          </div>
        </motion.div>

        {/* Completed summary */}
        {isCompleted && session.total_hours != null && session.total_amount != null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Session Summary</p>
            </div>
            <div className="grid divide-y divide-zinc-100 dark:divide-zinc-800">
              <Row icon={<Clock className="w-4 h-4 text-zinc-400" />} label="Duration" value={formatDuration(session.total_hours)} />
              {session.exit_time && (
                <Row icon={<Clock className="w-4 h-4 text-zinc-400" />} label="Exited" value={formatTime(session.exit_time)} />
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">Total</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">PKR {session.total_amount}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Retrieval section */}
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.div
              key="retrieval"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.2 }}
            >
              {canRequestRetrieval && (
                <>
                  <button
                    onClick={handleRequestRetrieval}
                    disabled={retrievalLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {retrievalLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Requesting…</>
                    ) : (
                      <><Car className="w-4 h-4" /> Request Car Retrieval</>
                    )}
                  </button>
                  {retrievalError && (
                    <p className="text-xs text-red-500 text-center mt-2">{retrievalError}</p>
                  )}
                </>
              )}

              {(session.retrieval_status === "requested" || retrievalRequested) && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-4">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Car className="w-5 h-5 text-amber-600" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      Retrieval Requested
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Staff will bring your vehicle shortly
                    </p>
                  </div>
                </div>
              )}

              {session.retrieval_status === "in_progress" && (
                <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="w-5 h-5 text-blue-600" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Valet Is Bringing Your Car
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Please proceed to the pickup area
                    </p>
                  </div>
                </div>
              )}

              {session.retrieval_status === "completed" && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-4 py-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Vehicle Ready
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Your vehicle is waiting at the pickup point
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-zinc-400 dark:text-zinc-600">
        Powered by ParkFlow
      </footer>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon}
      <span className="text-sm text-zinc-500 dark:text-zinc-400 flex-1">{label}</span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-white text-right">{value}</span>
    </div>
  );
}
