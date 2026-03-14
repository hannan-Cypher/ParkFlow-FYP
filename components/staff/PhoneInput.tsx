"use client";

import React from "react";
import { validatePakistaniPhone } from "@/lib/whatsapp";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidNumber: (normalized: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Pakistani phone input with:
 * - 🇵🇰 +92 left adornment
 * - Strips non-digit characters as user types
 * - Validates using validatePakistaniPhone()
 * - Calls onValidNumber(normalized) when a valid number is detected (debounced 300ms)
 * - Shows green checkmark / red X validation state
 */
export default function PhoneInput({
  value,
  onChange,
  onValidNumber,
  disabled = false,
  autoFocus = false,
  className = "",
}: PhoneInputProps) {
  const validCallbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [touched, setTouched] = React.useState(false);

  const validation = React.useMemo(() => {
    if (!value) return null;
    return validatePakistaniPhone(value);
  }, [value]);

  const isValid = validation?.valid ?? false;
  const showValidation = touched && value.replace(/\D/g, "").length >= 4;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digit characters (allow digits and leading +)
    const raw = e.target.value.replace(/[^\d]/g, "");
    onChange(raw);
    setTouched(true);

    // Debounce the valid callback
    if (validCallbackRef.current) clearTimeout(validCallbackRef.current);
    if (raw.length >= 4) {
      validCallbackRef.current = setTimeout(() => {
        const result = validatePakistaniPhone(raw);
        if (result.valid) {
          onValidNumber(result.normalized);
        }
      }, 300);
    }
  };

  // Format value for display: "300 1234567"
  const displayValue = React.useMemo(() => {
    const digits = value.replace(/\D/g, "");
    // Strip leading 0 or 92 for display
    let local = digits;
    if (digits.startsWith("92") && digits.length <= 12) local = digits.slice(2);
    else if (digits.startsWith("0")) local = digits.slice(1);

    if (local.length <= 3) return local;
    return local.slice(0, 3) + " " + local.slice(3);
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (validCallbackRef.current) clearTimeout(validCallbackRef.current);
    };
  }, []);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
    <div className="flex items-stretch">
      {/* Country code prefix */}
      <div className="flex items-center gap-1 rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 select-none shrink-0">
        <span>🇵🇰</span>
        <span>+92</span>
      </div>

      {/* Phone number input */}
      <div className="relative flex-1">
        <input
          type="tel"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder="3XX XXXXXXX"
          className={`w-full rounded-r-xl border px-4 py-3 pr-10 text-sm outline-none transition-colors
            dark:bg-slate-700 dark:text-white dark:placeholder-slate-400
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${
              showValidation
                ? isValid
                  ? "border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/10"
                  : "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400 bg-red-50 dark:bg-red-900/10"
                : "border-slate-300 dark:border-slate-600 bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            }`}
        />
        {/* Validation icon */}
        {showValidation && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base">
            {isValid ? (
              <span className="text-emerald-500">✓</span>
            ) : (
              <span className="text-red-500">✕</span>
            )}
          </span>
        )}
      </div>

    </div>

      {/* Error message */}
      {showValidation && !isValid && validation?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {validation.error}
        </p>
      )}
    </div>
  );
}
