"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, User, Car, Star } from "lucide-react";

interface LookupResult {
  found: boolean;
  isReturning: boolean;
  matchedByPhone: boolean;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    total_visits: number;
    last_visit?: string | null;
  } | null;
  vehicle: {
    license_plate: string;
    make: string | null;
    model: string | null;
    color: string | null;
    vehicle_type: string;
  } | null;
}

interface CustomerLookupResultProps {
  isLoading: boolean;
  result: LookupResult | null;
  onNewCustomerNameChange?: (name: string) => void;
}

/**
 * Displays the customer lookup result as:
 * 1. Loading skeleton (pulse)
 * 2. Green card — returning customer with stats
 * 3. Blue card — new customer with optional name input
 *
 * Uses Framer Motion AnimatePresence for crossfade transitions.
 */
export default function CustomerLookupResult({
  isLoading,
  result,
  onNewCustomerNameChange,
}: CustomerLookupResultProps) {
  if (!isLoading && !result) return null;

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
            <div className="h-5 w-14 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          </div>
          <div className="h-2.5 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </motion.div>
      )}

      {!isLoading && result?.matchedByPhone && result.customer && (
        <motion.div
          key="returning"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Welcome back, {result.customer.full_name}!
            </span>
            <span className="ml-auto text-xs bg-emerald-100 dark:bg-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-full px-2.5 py-0.5 font-medium flex items-center gap-1 shrink-0">
              <Star className="h-3 w-3" />
              {result.customer.total_visits} visit{result.customer.total_visits !== 1 ? "s" : ""}
            </span>
          </div>

          {result.customer.last_visit && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Last visit:{" "}
              {new Date(result.customer.last_visit).toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}

          {result.vehicle && (
            <div className="flex items-center gap-2 mt-1">
              <Car className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                {[result.vehicle.color, result.vehicle.make, result.vehicle.model]
                  .filter(Boolean)
                  .join(" ") || result.vehicle.license_plate}
                {" • "}
                <span className="font-mono">{result.vehicle.license_plate}</span>
              </p>
            </div>
          )}
        </motion.div>
      )}

      {!isLoading && result && !result.matchedByPhone && (
        <motion.div
          key="new"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
              New Customer
            </span>
            <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-300 rounded-full px-2.5 py-0.5 font-medium">
              First visit
            </span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            No account found for this number. A guest check-in will be created.
          </p>
          {onNewCustomerNameChange && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Customer Name (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ahmed Khan"
                onChange={(e) => onNewCustomerNameChange(e.target.value)}
                className="w-full rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
