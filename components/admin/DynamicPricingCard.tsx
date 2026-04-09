'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  Zap,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface PeakHour {
  start: string
  end: string
  label: string
}

interface PricingConfig {
  venue_id: string
  name: string
  base_rate_per_hour: number
  high_occupancy_threshold: number
  high_occupancy_multiplier: number
  critical_occupancy_threshold: number
  critical_occupancy_multiplier: number
  peak_hours: PeakHour[]
  peak_hour_surcharge: number
  max_rate_per_hour: number
  min_rate_per_hour: number
  is_dynamic_enabled: boolean
  vip_base_rate_per_hour: number | null
  vip_high_occupancy_multiplier: number | null
  vip_critical_occupancy_multiplier: number | null
}

interface LiveRate {
  rate: number
  base_rate: number
  occupancy_percent: number
  occupied_slots: number
  total_slots: number
  multiplier_used: number
  peak_surcharge_applied: number
  is_peak_hour: boolean
  peak_label: string | null
  is_dynamic_enabled: boolean
}

interface Venue {
  id: string
  name: string
  city: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt24to12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-sm
        ${type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' : 'bg-red-50/90 border-red-200 text-red-800'}`}
    >
      {type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
      <p className="text-sm font-medium">{msg}</p>
    </motion.div>
  )
}

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  disabled,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      <div className={`flex items-center gap-0 border rounded-xl overflow-hidden transition-colors
        ${disabled
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus-within:border-sky-400 dark:focus-within:border-sky-500'
        }`}
      >
        {prefix && (
          <span className="px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-r border-slate-200 dark:border-slate-600">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white bg-transparent outline-none disabled:cursor-not-allowed"
        />
        {suffix && (
          <span className="px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-l border-slate-200 dark:border-slate-600">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function DynamicPricingCard() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [liveRate, setLiveRate] = useState<LiveRate | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [loadingLive, setLoadingLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [selectedClass, setSelectedClass] = useState<'standard' | 'vip'>('standard')

  // ── Load venues ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(d => {
        const list: Venue[] = (d.locations || []).map((l: Venue) => ({
          id: l.id,
          name: l.name,
          city: l.city,
        }))
        setVenues(list)
        if (list.length > 0) setSelectedVenueId(list[0].id)
      })
      .catch(console.error)
  }, [])

  // ── Load pricing config when venue changes ─────────────────────────────
  const loadConfig = useCallback(async (venueId: string) => {
    if (!venueId) return
    setLoadingConfig(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/pricing`)
      if (res.ok) setConfig(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  const loadLiveRate = useCallback(async (venueId: string, className: 'standard' | 'vip' = 'standard') => {
    if (!venueId) return
    setLoadingLive(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/current-rate?class=${className}`)
      if (res.ok) setLiveRate(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingLive(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedVenueId) return
    loadConfig(selectedVenueId)
    loadLiveRate(selectedVenueId, selectedClass)
  }, [selectedVenueId, selectedClass, loadConfig, loadLiveRate])

  // ── Save handler ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch(`/api/venues/${config.venue_id}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        const updated = await res.json()
        setConfig(updated)
        setToast({ type: 'success', msg: 'Pricing configuration saved!' })
        loadLiveRate(config.venue_id)
      } else {
        const err = await res.json()
        setToast({ type: 'error', msg: err.error || 'Failed to save' })
      }
    } catch {
      setToast({ type: 'error', msg: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Peak hour helpers ──────────────────────────────────────────────────
  const addPeakHour = () => {
    if (!config) return
    setConfig({
      ...config,
      peak_hours: [...config.peak_hours, { start: '09:00', end: '11:00', label: 'New Window' }],
    })
  }

  const removePeakHour = (index: number) => {
    if (!config) return
    setConfig({ ...config, peak_hours: config.peak_hours.filter((_, i) => i !== index) })
  }

  const updatePeakHour = (index: number, field: keyof PeakHour, value: string) => {
    if (!config) return
    const updated = config.peak_hours.map((ph, i) => i === index ? { ...ph, [field]: value } : ph)
    setConfig({ ...config, peak_hours: updated })
  }

  const disabled = !config?.is_dynamic_enabled

  // ── Live rate status text ──────────────────────────────────────────────
  function liveStatusText() {
    if (!liveRate) return null
    if (!liveRate.is_dynamic_enabled) return <span className="text-slate-500">Dynamic Pricing Off</span>
    if (liveRate.is_peak_hour) return <span className="text-amber-600 font-semibold">Peak Hour — {liveRate.peak_label}</span>
    if (liveRate.occupancy_percent >= 95) return <span className="text-red-600 font-semibold">Critical Demand</span>
    if (liveRate.occupancy_percent >= 80) return <span className="text-orange-600 font-semibold">High Demand</span>
    return <span className="text-emerald-600 font-semibold">Normal</span>
  }

  return (
    <>
      <AnimatePresence>
        {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Dynamic Pricing</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Auto-adjusts rate based on occupancy &amp; peak hours</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Class Toggle */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
              <button
                onClick={() => setSelectedClass('standard')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${selectedClass === 'standard' ? 'bg-white dark:bg-slate-600 text-sky-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Standard
              </button>
              <button
                onClick={() => setSelectedClass('vip')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${selectedClass === 'vip' ? 'bg-white dark:bg-slate-600 text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                VIP
              </button>
            </div>

            {/* Venue selector */}
            <div className="relative">
              <select
                value={selectedVenueId}
                onChange={e => setSelectedVenueId(e.target.value)}
                className="appearance-none pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400 cursor-pointer"
              >
                {venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {loadingConfig ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
          </div>
        ) : !config ? null : (
          <div className="space-y-6">
            {/* ── Top row: Toggle + Live Rate card ───────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Enable toggle + base rate */}
              <div className="space-y-4">
                {/* Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">Enable Dynamic Pricing</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {config.is_dynamic_enabled ? 'Rate adjusts automatically' : 'Flat base rate applied'}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, is_dynamic_enabled: !config.is_dynamic_enabled })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none
                      ${config.is_dynamic_enabled ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform
                        ${config.is_dynamic_enabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                {/* Base Rate — prominent */}
                <div className={`p-4 rounded-xl border-2 transition-colors ${selectedClass === 'vip' ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : 'border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${selectedClass === 'vip' ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}`}>
                    {selectedClass === 'vip' ? 'VIP Base Rate' : 'Standard Base Rate'} (PKR / hr)
                  </p>
                  <div className={`flex items-center gap-2 border rounded-xl overflow-hidden bg-white dark:bg-slate-800 ${selectedClass === 'vip' ? 'border-amber-300 dark:border-amber-600' : 'border-sky-300 dark:border-sky-600'}`}>
                    <span className={`px-3 py-3 text-sm font-semibold border-r ${selectedClass === 'vip' ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700' : 'text-sky-500 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700'}`}>
                      Rs.
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={selectedClass === 'vip' ? (config.vip_base_rate_per_hour ?? 0) : config.base_rate_per_hour}
                      onChange={e => {
                        const val = Number(e.target.value)
                        setConfig(selectedClass === 'vip'
                          ? { ...config, vip_base_rate_per_hour: val }
                          : { ...config, base_rate_per_hour: val }
                        )
                      }}
                      className="flex-1 px-3 py-3 text-xl font-extrabold text-slate-900 dark:text-white bg-transparent outline-none"
                    />
                    <span className="px-3 py-3 text-xs text-slate-400">/hr</span>
                  </div>
                  {!config.is_dynamic_enabled && (
                    <p className={`text-xs mt-2 ${selectedClass === 'vip' ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}`}>
                      This flat rate is used when dynamic pricing is off.
                    </p>
                  )}
                </div>
              </div>

              {/* Live Rate Card */}
              <div className={`rounded-xl border-2 p-5 flex flex-col justify-between
                ${liveRate?.is_peak_hour ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${liveRate?.is_peak_hour ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Live Rate</span>
                  </div>
                  <button
                    onClick={() => loadLiveRate(selectedVenueId)}
                    disabled={loadingLive}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {liveRate ? (
                  <>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">
                      Rs. {Math.round(liveRate.rate).toLocaleString()}
                      <span className="text-base font-semibold text-slate-400 ml-1">/hr</span>
                    </p>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Occupancy</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {liveRate.occupancy_percent}% ({liveRate.occupied_slots}/{liveRate.total_slots} slots)
                        </span>
                      </div>
                      {liveRate.multiplier_used > 1 && (
                        <div className="flex justify-between">
                          <span>Multiplier</span>
                          <span className="font-semibold text-orange-600">{liveRate.multiplier_used}×</span>
                        </div>
                      )}
                      {liveRate.peak_surcharge_applied > 0 && (
                        <div className="flex justify-between">
                          <span>Peak surcharge</span>
                          <span className="font-semibold text-amber-600">+Rs.{liveRate.peak_surcharge_applied}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-600">
                        <span>Status</span>
                        <span>{liveStatusText()}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 py-4">
                    <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* ── Occupancy Thresholds ────────────────────────────────────── */}
            <div className={`space-y-4 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Occupancy-Based Multipliers
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* High demand */}
                <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 space-y-3">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">High Demand</p>
                  <NumInput
                    label="Threshold"
                    value={config.high_occupancy_threshold}
                    onChange={v => setConfig({ ...config, high_occupancy_threshold: v })}
                    min={1} max={99} suffix="%"
                    hint={`When ≥${config.high_occupancy_threshold}% of slots are filled`}
                  />
                  <NumInput
                    label="Multiplier"
                    value={selectedClass === 'vip' ? (config.vip_high_occupancy_multiplier ?? 1.5) : config.high_occupancy_multiplier}
                    onChange={v => setConfig(selectedClass === 'vip'
                      ? { ...config, vip_high_occupancy_multiplier: v }
                      : { ...config, high_occupancy_multiplier: v }
                    )}
                    min={1} step={0.1} suffix="×"
                    hint={`Rate: Rs.${selectedClass === 'vip' ? (config.vip_base_rate_per_hour || 0) : config.base_rate_per_hour} × ${selectedClass === 'vip' ? (config.vip_high_occupancy_multiplier || 1.5) : config.high_occupancy_multiplier} = Rs.${Math.round((selectedClass === 'vip' ? (config.vip_base_rate_per_hour || 0) : config.base_rate_per_hour) * (selectedClass === 'vip' ? (config.vip_high_occupancy_multiplier || 1.5) : config.high_occupancy_multiplier))}`}
                  />
                </div>

                {/* Critical demand */}
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 space-y-3">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Critical Demand</p>
                  <NumInput
                    label="Threshold"
                    value={config.critical_occupancy_threshold}
                    onChange={v => setConfig({ ...config, critical_occupancy_threshold: v })}
                    min={1} max={100} suffix="%"
                    hint={`When ≥${config.critical_occupancy_threshold}% of slots are filled`}
                  />
                  <NumInput
                    label="Multiplier"
                    value={selectedClass === 'vip' ? (config.vip_critical_occupancy_multiplier ?? 2.0) : config.critical_occupancy_multiplier}
                    onChange={v => setConfig(selectedClass === 'vip'
                      ? { ...config, vip_critical_occupancy_multiplier: v }
                      : { ...config, critical_occupancy_multiplier: v }
                    )}
                    min={1} step={0.1} suffix="×"
                    hint={`Rate: Rs.${selectedClass === 'vip' ? (config.vip_base_rate_per_hour || 0) : config.base_rate_per_hour} × ${selectedClass === 'vip' ? (config.vip_critical_occupancy_multiplier || 2.0) : config.critical_occupancy_multiplier} = Rs.${Math.round((selectedClass === 'vip' ? (config.vip_base_rate_per_hour || 0) : config.base_rate_per_hour) * (selectedClass === 'vip' ? (config.vip_critical_occupancy_multiplier || 2.0) : config.critical_occupancy_multiplier))}`}
                  />
                </div>
              </div>
            </div>

            {/* ── Peak Hours ─────────────────────────────────────────────── */}
            <div className={`space-y-4 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Peak Hour Windows
                </h3>
                <button
                  onClick={addPeakHour}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-600 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Window
                </button>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {config.peak_hours.map((ph, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Start</label>
                        <input
                          type="time"
                          value={ph.start}
                          onChange={e => updatePeakHour(i, 'start', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400"
                        />
                        <p className="text-xs text-slate-400">{fmt24to12(ph.start)}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">End</label>
                        <input
                          type="time"
                          value={ph.end}
                          onChange={e => updatePeakHour(i, 'end', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400"
                        />
                        <p className="text-xs text-slate-400">{fmt24to12(ph.end)}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Label</label>
                        <input
                          type="text"
                          value={ph.label}
                          onChange={e => updatePeakHour(i, 'label', e.target.value)}
                          placeholder="e.g. Morning Rush"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400"
                        />
                      </div>
                      <button
                        onClick={() => removePeakHour(i)}
                        className="p-2.5 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {config.peak_hours.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                    No peak hour windows defined
                  </p>
                )}
              </div>

              <NumInput
                label="Peak Hour Surcharge (PKR)"
                value={config.peak_hour_surcharge}
                onChange={v => setConfig({ ...config, peak_hour_surcharge: v })}
                min={0} step={10} prefix="Rs."
                hint="Added on top of the occupancy-adjusted rate during peak windows"
              />
            </div>

            {/* ── Rate Caps ──────────────────────────────────────────────── */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <NumInput
                label="Minimum Rate (PKR/hr)"
                value={config.min_rate_per_hour}
                onChange={v => setConfig({ ...config, min_rate_per_hour: v })}
                min={0} step={10} prefix="Rs."
                hint="Rate will never go below this"
              />
              <NumInput
                label="Maximum Rate (PKR/hr)"
                value={config.max_rate_per_hour}
                onChange={v => setConfig({ ...config, max_rate_per_hour: v })}
                min={0} step={10} prefix="Rs."
                hint="Rate will never exceed this"
              />
            </div>

            {/* ── Save button ────────────────────────────────────────────── */}
            <div className="flex justify-end pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-bold text-sm shadow-md transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Pricing Config'}
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
