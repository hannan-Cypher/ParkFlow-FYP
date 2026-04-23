'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  Car,
  ChevronDown,
  MapPin,
  Clock,
  User,
  Camera,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'

import { ImagePreviewModal } from './ImagePreviewModal'
import { formatSessionDateTime, getArrowConfig } from '@/lib/dateTimeUtils'
import { getHeaderPhotos, getPhotoLabel, type DamagePhoto } from '@/lib/photoUtils'


// ── Types ─────────────────────────────────────────────────────────────────

export interface CollapsibleSessionData {
  id: string;
  license_plate: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
  status: string;
  venue_name: string;
  slot_display: string;
  entry_time: string;
  exit_time: string | null;
  duration: string | null;
  total_amount: number | null;
  wash_amount?: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  damage_photos: Array<{ url: string; label?: string }> | null;
  parked_by_name?: string | null;
  retrieved_by_name?: string | null;
}

/**
 * viewerRole controls what level of detail is shown:
 *
 *  • driver    → Parking basics only (customer name WITHOUT phone,
 *                vehicle details, slot info, total time). No billing.
 *  • washer    → Uses its own WashTaskCard – this component is not used.
 *  • supervisor / admin → Full details: customer WITH phone, vehicle,
 *                slot, billing, damage photos, staff who handled it.
 */
export type ViewerRole = 'driver' | 'supervisor' | 'admin';

// ── Helpers ───────────────────────────────────────────────────────────────

function vehicleLabel(d: CollapsibleSessionData): string {
  return [d.vehicle_color, d.vehicle_make, d.vehicle_model]
    .filter(Boolean)
    .join(' ') || d.vehicle_type || 'Vehicle';
}

// ── Component ─────────────────────────────────────────────────────────────

export function CollapsibleSessionCard({
  session,
  isExpanded,
  onToggleExpand,
  viewerRole,
}: {
  session: CollapsibleSessionData;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  viewerRole: ViewerRole;
}) {
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label?: string } | null>(null);
  const isCompleted = session.status === 'completed';
  const statusCfg = isCompleted
    ? { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completed' }
    : { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Active' };

  const entryDate = new Date(session.entry_time);
  const timeStr = entryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Role-based visibility flags
  const canSeePhone = viewerRole === 'admin' || viewerRole === 'supervisor';
  const canSeeBilling = viewerRole === 'admin' || viewerRole === 'supervisor';
  const canSeePhotos = viewerRole === 'admin' || viewerRole === 'supervisor';
  const canSeeStaff = viewerRole === 'admin' || viewerRole === 'supervisor';

  return (
    <motion.div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
      variants={{ rest: { scale: 1 }, hover: { scale: 1.01 } }}
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      {/* ── Header (clickable) ──────────────────────────────────────────── */}
      <div
        onClick={() => onToggleExpand(session.id)}
        className="flex items-start justify-between gap-3 p-4 cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusCfg.bg}`}>
            <Car className={`w-5 h-5 ${statusCfg.text}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold font-mono tracking-wider text-slate-900 dark:text-white truncate">
                {session.license_plate}
              </span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {vehicleLabel(session)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Header Photo Preview (Collapsed) */}
          {!isExpanded && canSeePhotos && session.damage_photos && session.damage_photos.length > 0 && (
            <div className="hidden sm:flex -space-x-2 overflow-hidden items-center mr-2">
              {getHeaderPhotos(session.damage_photos as DamagePhoto[]).map((photo, i) => (
                <div
                  key={i}
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-700"
                >
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
              {session.damage_photos.length > 3 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 ring-2 ring-white dark:ring-slate-800">
                  +{session.damage_photos.length - 3}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col items-end shrink-0">
            {/* Only supervisor / admin see billing */}
            {canSeeBilling && session.total_amount != null && (
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                Rs.{Math.round((Number(session.total_amount ?? 0) + Number(session.wash_amount ?? 0))).toLocaleString()}
                {(session.wash_amount ?? 0) > 0 && (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1">
                    (incl. wash)
                  </span>
                )}
              </div>
            )}
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
              {session.duration || timeStr}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-slate-400 dark:text-slate-500 ml-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Always-visible strip ────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-[11px] font-medium">
          {/* Check-in */}
          <div className="flex items-center gap-1.5">
            <div className={`flex h-5 w-5 items-center justify-center rounded-md ${getArrowConfig('in').bg}`}>
              <ArrowDownLeft className={`h-3 w-3 ${getArrowConfig('in').text}`} />
            </div>
            <span className="text-slate-500 dark:text-slate-400">In: {formatSessionDateTime(session.entry_time)}</span>
          </div>

          {/* Check-out (if completed) */}
          {session.status === 'completed' && session.exit_time && (
            <div className="flex items-center gap-1.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded-md ${getArrowConfig('out').bg}`}>
                <ArrowUpRight className={`h-3 w-3 ${getArrowConfig('out').text}`} />
              </div>
              <span className="text-slate-500 dark:text-slate-400">Out: {formatSessionDateTime(session.exit_time)}</span>
            </div>
          )}

          {session.slot_display && (
            <div className="flex items-center gap-1.5 text-slate-400 sm:ml-auto">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{session.venue_name} • {session.slot_display}</span>
            </div>
          )}
        </div>

        {/* ── Expandable detail panel ───────────────────────────────────── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-3">

                {/* ── Customer ─────────────────────────────────────────── */}
                {session.customer_name && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Customer
                    </p>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {session.customer_name}
                      </p>
                      {/* Phone visible ONLY to admin & supervisor */}
                      {canSeePhone && session.customer_phone && (
                        <p className="font-mono text-slate-500 dark:text-slate-400">
                          {session.customer_phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Vehicle details ──────────────────────────────────── */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Vehicle
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {session.vehicle_make && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Make </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{session.vehicle_make}</span>
                      </div>
                    )}
                    {session.vehicle_model && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Model </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{session.vehicle_model}</span>
                      </div>
                    )}
                    {session.vehicle_color && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Color </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{session.vehicle_color}</span>
                      </div>
                    )}
                    {session.vehicle_type && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500">Type </span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium capitalize">{session.vehicle_type}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Parking slot info ────────────────────────────────── */}
                {session.slot_display && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Slot
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {session.slot_display}
                    </span>
                  </div>
                )}

                {/* ── Total time ───────────────────────────────────────── */}
                {session.duration && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Total Time
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {session.duration}
                    </span>
                  </div>
                )}

                {/* ── Billing — admin / supervisor only ────────────────── */}
                {canSeeBilling && session.total_amount != null && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 space-y-2">
                    {(session.wash_amount ?? 0) > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Parking</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            Rs.{Math.round(session.total_amount ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-sky-600 dark:text-sky-400">Car Wash</span>
                          <span className="font-medium text-sky-700 dark:text-sky-300">
                            Rs.{Math.round(session.wash_amount ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t border-emerald-200 dark:border-emerald-700 pt-2 flex items-center justify-between text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Total Charged</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            Rs.{Math.round((Number(session.total_amount ?? 0) + Number(session.wash_amount ?? 0))).toLocaleString()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Amount Charged</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          Rs.{Math.round(session.total_amount).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Staff info — admin / supervisor only ──────────── */}
                {canSeeStaff && (
                  <>
                    {session.parked_by_name && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Parked by
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {session.parked_by_name}
                        </span>
                      </div>
                    )}
                    {session.retrieved_by_name && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center justify-between text-xs mt-2">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Delivered by
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {session.retrieved_by_name}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* ── Damage photos — admin / supervisor only ──────────── */}
                {canSeePhotos && session.damage_photos && session.damage_photos.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 px-1">
                      <Camera className="w-3.5 h-3.5" /> Damage Assessment ({session.damage_photos.length} Photos)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {session.damage_photos.map((photo, i) => (
                        <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group bg-slate-100 dark:bg-slate-900">
                          <img
                            src={photo.url}
                            alt={getPhotoLabel(photo as DamagePhoto, i)}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto(photo);
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            {getPhotoLabel(photo as DamagePhoto, i)}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto(photo);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ImagePreviewModal
        isOpen={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        imageUrl={previewPhoto?.url || ''}
        imageAlt={previewPhoto?.label}
      />
    </motion.div>
  );
}
