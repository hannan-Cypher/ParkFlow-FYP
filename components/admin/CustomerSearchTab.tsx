'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    X,
    Loader2,
    Car,
    MapPin,
    Star,
    ChevronRight,
    History,
    Phone,
    Mail,
    Droplets,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Users,
} from 'lucide-react'
import { CollapsibleSessionCard, type CollapsibleSessionData } from '../shared/CollapsibleSessionCard'
import { useRealtime } from '@/hooks/useRealtime'

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomerResult {
    id: string
    full_name: string
    email: string
    phone: string
    created_at: string
    is_active: boolean
    vehicle_count: number
    total_sessions: number
    active_sessions: number
    last_visit: string | null
}

interface CustomerDetail {
    id: string
    full_name: string
    email: string
    phone: string
    is_active: boolean
    email_verified: boolean
    phone_verified: boolean
    last_login: string | null
    created_at: string
    updated_at: string
    total_sessions: number
    total_spent: number
    avg_rating: number | null
}

interface Vehicle {
    id: string
    license_plate: string
    make: string | null
    model: string | null
    color: string | null
    year: number | null
    vehicle_type: string
    is_primary: boolean
    notes: string | null
    created_at: string
    session_count: number
}

interface Session {
    id: string
    status: string
    entry_time: string
    exit_time: string | null
    rate_per_hour: number | null
    total_hours: number | null
    total_amount: number | null
    wash_amount: number | null
    payment_status: string
    rating: number | null
    rating_comment: string | null
    retrieval_status: string | null
    license_plate: string
    vehicle_make: string | null
    vehicle_model: string | null
    vehicle_color: string | null
    venue_name: string | null
    venue_city: string | null
    slot_number: string | null
    floor_level: string | null
    staff_name: string | null
    damage_photos: Array<{ url: string; label?: string }> | null
}

interface WashRequest {
    id: string
    wash_type: string
    service_status: string
    service_cost: number | null
    notes: string | null
    started_at: string | null
    completed_at: string | null
    created_at: string
    washer_name: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-PK', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-PK', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const GRADIENTS = [
    'from-blue-500 to-cyan-500',
    'from-teal-500 to-green-500',
    'from-purple-500 to-pink-500',
    'from-orange-500 to-red-500',
    'from-rose-500 to-fuchsia-500',
]

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

// ── Session status badge ───────────────────────────────────────────────────

function SessionStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        active: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Active' },
        completed: { bg: 'bg-sky-50 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400', label: 'Completed' },
        cancelled: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Cancelled' },
    }
    const style = config[status] ?? { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: status }

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
            {style.label}
        </span>
    )
}

// ── Wash type badge ────────────────────────────────────────────────────────

function WashTypeBadge({ type }: { type: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        basic: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', label: 'Basic Wash' },
        full: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', label: 'Full Wash' },
        premium: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: 'Premium Detail' },
    }
    const style = config[type] ?? { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: type }

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${style.bg} ${style.text}`}>
            {style.label}
        </span>
    )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CustomerSearchTab() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<CustomerResult[]>([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)

    // Detail view state
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
    const [detail, setDetail] = useState<CustomerDetail | null>(null)
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [sessions, setSessions] = useState<Session[]>([])
    const [washRequests, setWashRequests] = useState<WashRequest[]>([])
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailTab, setDetailTab] = useState<'sessions' | 'vehicles' | 'washes'>('sessions')

    const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set())

    const toggleExpandSession = useCallback((id: string) => {
        setExpandedSessionIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, [])

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // ── Search handler with debounce ──────────────────────────────────────
    const performSearch = useCallback(async (searchTerm: string) => {
        if (!searchTerm.trim()) {
            setResults([])
            setHasSearched(false)
            return
        }
        setLoading(true)
        setHasSearched(true)
        try {
            const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(searchTerm)}`)
            if (res.ok) {
                const data = await res.json()
                setResults(data.customers)
            }
        } catch {
            // silently ignore
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            performSearch(query)
        }, 350)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query, performSearch])

    // ── Fetch customer details ────────────────────────────────────────────
    const fetchCustomerDetail = useCallback(async (customerId: string) => {
        try {
            const res = await fetch(`/api/admin/customers/${customerId}`)
            if (res.ok) {
                const data = await res.json()
                setDetail(data.customer)
                setVehicles(data.vehicles)
                setSessions(data.sessions)
                setWashRequests(data.wash_requests)
            }
        } catch {
            // silently ignore
        }
    }, [])

    const openDetail = async (customerId: string) => {
        setSelectedCustomerId(customerId)
        setDetailLoading(true)
        setDetailTab('sessions')
        await fetchCustomerDetail(customerId)
        setDetailLoading(false)
    }

    // Real-time updates via SSE
    useRealtime(useCallback((event) => {
        if (selectedCustomerId && (event.table === 'parking_sessions' || event.table === 'service_requests' || event.table === 'vehicles')) {
            fetchCustomerDetail(selectedCustomerId);
        }
    }, [selectedCustomerId, fetchCustomerDetail]), ['parking_sessions', 'service_requests', 'vehicles']);

    const closeDetail = () => {
        setSelectedCustomerId(null)
        setDetail(null)
        setVehicles([])
        setSessions([])
        setWashRequests([])
    }

    // ── Focus input on mount ──────────────────────────────────────────────
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // ═══════════════════════════════════════════════════════════════════════
    // DETAIL VIEW
    // ═══════════════════════════════════════════════════════════════════════

    if (selectedCustomerId) {
        return (
            <div>
                {/* Back button */}
                <button
                    onClick={closeDetail}
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 font-medium mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to search results
                </button>

                {detailLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                    </div>
                ) : detail ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-5"
                    >
                        {/* ── Customer profile card ────────────────────────────────── */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${GRADIENTS[detail.full_name.charCodeAt(0) % GRADIENTS.length]} flex items-center justify-center flex-shrink-0`}>
                                    <span className="text-white font-bold text-lg">
                                        {getInitials(detail.full_name)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                        {detail.full_name}
                                    </h3>
                                    <div className="flex items-center gap-3 flex-wrap mt-1">
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${detail.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${detail.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {detail.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            Customer since {formatDate(detail.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Email</div>
                                        <div className="text-sm text-slate-700 dark:text-slate-200 truncate">{detail.email}</div>
                                    </div>
                                    {detail.email_verified && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Phone</div>
                                        <div className="text-sm text-slate-700 dark:text-slate-200">{detail.phone}</div>
                                    </div>
                                    {detail.phone_verified && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />
                                    )}
                                </div>
                            </div>

                            {/* Summary stats */}
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-center">
                                    <div className="text-xl font-bold text-sky-700 dark:text-sky-300">{detail.total_sessions}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">Sessions</div>
                                </div>
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Rs.{Math.round(detail.total_spent).toLocaleString()}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">Total Spent</div>
                                </div>
                                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                                    <div className="text-xl font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1">
                                        {detail.avg_rating ? (
                                            <>
                                                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                                {detail.avg_rating}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">Avg Rating</div>
                                </div>
                            </div>
                        </div>

                        {/* ── Detail tabs ──────────────────────────────────────────── */}
                        <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            {([
                                { key: 'sessions' as const, label: 'Sessions', icon: History, count: sessions.length },
                                { key: 'vehicles' as const, label: 'Vehicles', icon: Car, count: vehicles.length },
                                { key: 'washes' as const, label: 'Washes', icon: Droplets, count: washRequests.length },
                            ]).map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setDetailTab(tab.key)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${detailTab === tab.key
                                        ? 'bg-sky-600 text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${detailTab === tab.key
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'
                                        }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* ── Session list ─────────────────────────────────────────── */}
                        {detailTab === 'sessions' && (
                            <div className="space-y-2">
                                {sessions.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <History className="w-10 h-10 opacity-20 mx-auto mb-2" />
                                        <p className="text-sm">No parking sessions yet</p>
                                    </div>
                                ) : (
                                    sessions.map((s) => {
                                        const sessionData: CollapsibleSessionData = {
                                            id: s.id,
                                            license_plate: s.license_plate,
                                            vehicle_make: s.vehicle_make,
                                            vehicle_model: s.vehicle_model,
                                            vehicle_color: s.vehicle_color,
                                            vehicle_type: null,
                                            status: s.status,
                                            venue_name: s.venue_name || "",
                                            slot_display: s.slot_number ? `Slot ${s.slot_number}${s.floor_level ? ` · F${s.floor_level}` : ''}` : '',
                                            entry_time: s.entry_time,
                                            exit_time: s.exit_time,
                                            duration: s.total_hours ? `${Number(s.total_hours).toFixed(1)}h` : null,
                                            total_amount: s.total_amount,
                                            wash_amount: s.wash_amount ?? null,
                                            customer_name: detail?.full_name || null,
                                            customer_phone: detail?.phone || null,
                                            damage_photos: s.damage_photos,
                                            staff_name: s.staff_name
                                        };
                                        return (
                                            <CollapsibleSessionCard
                                                key={s.id}
                                                session={sessionData}
                                                isExpanded={expandedSessionIds.has(s.id)}
                                                onToggleExpand={toggleExpandSession}
                                                viewerRole="admin"
                                            />
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* ── Vehicle list ─────────────────────────────────────────── */}
                        {detailTab === 'vehicles' && (
                            <div className="space-y-2">
                                {vehicles.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Car className="w-10 h-10 opacity-20 mx-auto mb-2" />
                                        <p className="text-sm">No registered vehicles</p>
                                    </div>
                                ) : (
                                    vehicles.map((v, i) => (
                                        <motion.div
                                            key={v.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 shrink-0">
                                                    <Car className="h-5 w-5 text-violet-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-bold text-slate-800 dark:text-white">{v.license_plate}</span>
                                                        {v.is_primary && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold uppercase">
                                                                Primary
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {[v.color, v.make, v.model, v.year].filter(Boolean).join(' · ') || v.vehicle_type}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{v.session_count}</div>
                                                    <div className="text-[10px] text-slate-400">sessions</div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ── Wash requests ────────────────────────────────────────── */}
                        {detailTab === 'washes' && (
                            <div className="space-y-2">
                                {washRequests.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Droplets className="w-10 h-10 opacity-20 mx-auto mb-2" />
                                        <p className="text-sm">No wash requests</p>
                                    </div>
                                ) : (
                                    washRequests.map((w, i) => (
                                        <motion.div
                                            key={w.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/30 shrink-0">
                                                        <Droplets className="h-4 w-4 text-sky-600" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <WashTypeBadge type={w.wash_type} />
                                                            <SessionStatusBadge status={w.service_status} />
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {formatDateTime(w.created_at)}
                                                            {w.washer_name && ` · ${w.washer_name}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                    Rs.{Math.round(w.service_cost ?? 0).toLocaleString()}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <div className="text-center py-16 text-slate-400">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>Failed to load customer details</p>
                    </div>
                )}
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SEARCH VIEW
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <div>
            {/* Header */}
            <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Customer Search</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Search by name, email, phone, or license plate
                </p>
            </div>

            {/* Search bar */}
            <div className="relative mb-5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search customers by name, email, phone, or plate…"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all placeholder:text-slate-400"
                />
                {query && (
                    <button
                        onClick={() => setQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
                </div>
            )}

            {/* Results */}
            {!loading && hasSearched && (
                <>
                    <p className="text-xs text-slate-400 mb-3">
                        {results.length} customer{results.length !== 1 ? 's' : ''} found
                    </p>

                    {results.length === 0 ? (
                        <div className="text-center py-16">
                            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">No customers found</h3>
                            <p className="text-sm text-slate-400">Try a different search term</p>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-2"
                        >
                            {results.map((c, i) => (
                                <motion.button
                                    key={c.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    onClick={() => openDetail(c.id)}
                                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-center justify-center flex-shrink-0`}>
                                            <span className="text-white font-bold text-sm">
                                                {getInitials(c.full_name)}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-800 dark:text-white truncate">{c.full_name}</span>
                                                {c.active_sessions > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Parked
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                                                <span>{c.email}</span>
                                                <span>·</span>
                                                <span>{c.phone}</span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="text-right shrink-0 hidden sm:block">
                                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{c.total_sessions} sessions</div>
                                            <div className="text-xs text-slate-400">{c.vehicle_count} vehicle{c.vehicle_count !== 1 ? 's' : ''}</div>
                                            {c.last_visit && (
                                                <div className="text-[10px] text-slate-400 mt-0.5">Last: {formatDate(c.last_visit)}</div>
                                            )}
                                        </div>

                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500 transition-colors shrink-0" />
                                    </div>
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </>
            )}

            {/* Empty state before search */}
            {!loading && !hasSearched && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center mx-auto mb-4">
                        <Search className="w-7 h-7 text-sky-400" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Search for a customer
                    </h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto">
                        Type a name, email, phone number, or vehicle license plate to find customers and view their details.
                    </p>
                </div>
            )}
        </div>
    )
}
