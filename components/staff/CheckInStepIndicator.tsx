"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export type CheckInStep = "scan" | "customer" | "vehicle" | "confirm" | "success";

const STEP_CONFIG: { key: CheckInStep; label: string }[] = [
  { key: "scan", label: "Scan" },
  { key: "customer", label: "Customer" },
  { key: "vehicle", label: "Vehicle" },
  { key: "confirm", label: "Confirm" },
  { key: "success", label: "Done" },
];

interface CheckInStepIndicatorProps {
  currentStep: CheckInStep;
  skippedSteps?: CheckInStep[];
}

/**
 * Horizontal step progress indicator for the check-in wizard.
 *
 * States:
 * - Completed: filled green circle with checkmark + green connector
 * - Current:   filled blue circle with pulse animation
 * - Skipped:   dash instead of circle (gray)
 * - Upcoming:  hollow gray circle
 *
 * On mobile (sm), only dots are shown (no labels).
 */
export default function CheckInStepIndicator({
  currentStep,
  skippedSteps = [],
}: CheckInStepIndicatorProps) {
  const currentIdx = STEP_CONFIG.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEP_CONFIG.map((step, i) => {
        const isCompleted = i < currentIdx && !skippedSteps.includes(step.key);
        const isCurrent = i === currentIdx;
        const isSkipped = skippedSteps.includes(step.key) && i < currentIdx;
        const isUpcoming = i > currentIdx;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              {/* Circle / dash */}
              {isSkipped ? (
                <div className="flex h-7 w-7 items-center justify-center">
                  <div className="h-0.5 w-4 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              ) : isCompleted ? (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500"
                >
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </motion.div>
              ) : isCurrent ? (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 shadow-md ring-2 ring-sky-300 dark:ring-sky-700"
                >
                  <span className="text-[11px] font-bold text-white">{i + 1}</span>
                </motion.div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {i + 1}
                  </span>
                </div>
              )}

              {/* Label — hidden on very small screens */}
              <span
                className={`hidden sm:block text-[10px] font-medium ${
                  isCurrent
                    ? "text-sky-600 dark:text-sky-400"
                    : isCompleted
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {i < STEP_CONFIG.length - 1 && (
              <div
                className={`mb-4 sm:mb-5 h-0.5 w-6 sm:w-10 mx-0.5 rounded-full transition-colors ${
                  i < currentIdx ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
