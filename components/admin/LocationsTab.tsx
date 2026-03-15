'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MapPin, Plus, Pencil, Trash2, X, CheckCircle, AlertCircle,
    Building2, Phone, Mail, Globe, Hash, Loader2, ChevronDown,
    ChevronRight, ChevronLeft, DoorOpen, Layers, LayoutGrid,
    Clock, Coffee, Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
    id: string; name: string; address: string; city: string; country: string
    total_slots: number; gates: number; contact_phone: string | null
    contact_email: string | null; status: 'active' | 'inactive' | 'maintenance'
    created_at: string; updated_at: string; gate_count?: number; zone_count?: number
}

interface GateFormData {
    name: string
    zones: { slots: string }[]
}

interface BasicFormData {
    name: string; address: string; city: string; country: string
    contact_phone: string; contact_email: string; status: 'active' | 'inactive' | 'maintenance'
    shift_start_time: string; shift_end_time: string; max_break_minutes: string
    enforce_shift_start_window: boolean
}

const defaultBasicForm: BasicFormData = {
    name: '', address: '', city: '', country: 'Pakistan',
    contact_phone: '', contact_email: '', status: 'active',
    shift_start_time: '09:00', shift_end_time: '18:00', max_break_minutes: '30',
    enforce_shift_start_window: true,
}

// ─── Zone Auto-Naming (mirrors backend) ───────────────────────────────────────
function generateZonePrefix(gateName: string): string {
    const words = gateName.trim().split(/\s+/)
    if (words.length > 1) return words.map(w => w[0]).join('').toUpperCase()
    return gateName.trim().substring(0, 2).toUpperCase()
}

// ─── Animation Variants ───────────────────────────────────────────────────────
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.25 } },
}
const overlayVariants = {
    hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
}
const modalVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.92, y: 30, transition: { duration: 0.2 } },
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Location['status'] }) {
    const map = {
        active: { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
        inactive: { bg: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', label: 'Inactive' },
        maintenance: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Maintenance' },
    }
    const s = map[status] ?? map.inactive
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    )
}

function Toast({ type, message, onClose }: { type: 'success' | 'error'; message: string; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
    return (
        <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
            className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-sm ${type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' : 'bg-red-50/90 border-red-200 text-red-800'}`}>
            {type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <p className="font-medium text-sm">{message}</p>
            <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
        </motion.div>
    )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label: string; icon: React.ElementType; required?: boolean }
function InputField({ label, icon: Icon, required, ...rest }: InputProps) {
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input {...rest} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all" />
            </div>
        </div>
    )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
    return (
        <div className="flex items-center gap-2 mb-6">
            {labels.map((label, i) => (
                <div key={i} className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= current ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}`}>
                        {i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:inline ${i <= current ? 'text-sky-600' : 'text-slate-400'}`}>{label}</span>
                    {i < total - 1 && <div className={`flex-1 h-0.5 ${i < current ? 'bg-sky-600' : 'bg-slate-200 dark:bg-slate-600'}`} />}
                </div>
            ))}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LocationsTab({ readOnly = false }: { readOnly?: boolean }) {
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Location | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // Wizard state
    const [wizardStep, setWizardStep] = useState(0)
    const [basicForm, setBasicForm] = useState<BasicFormData>(defaultBasicForm)
    const [gatesForm, setGatesForm] = useState<GateFormData[]>([{ name: '', zones: [{ slots: '' }] }])
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})

    const stepLabels = ['Basic Info', 'Gates', 'Zones', 'Slots', 'Review']

    // ─── Fetch ────────────────────────────────────────────────────────────────
    const fetchLocations = useCallback(async () => {
        try { setLoading(true); const res = await fetch('/api/locations'); if (!res.ok) throw new Error(); const data = await res.json(); setLocations(data.locations ?? []) }
        catch { showToast('error', 'Failed to load locations') }
        finally { setLoading(false) }
    }, [])
    useEffect(() => { fetchLocations() }, [fetchLocations])

    const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message })

    // ─── Modal helpers ────────────────────────────────────────────────────────
    const openAddModal = () => {
        setEditTarget(null); setBasicForm(defaultBasicForm)
        setGatesForm([{ name: '', zones: [{ slots: '' }] }])
        setWizardStep(0); setFormErrors({}); setModalOpen(true)
    }

    const openEditModal = async (loc: Location & { shift_start_time?: string; shift_end_time?: string; max_break_minutes?: number; enforce_shift_start_window?: boolean }) => {
        setEditTarget(loc)
        setBasicForm({
            name: loc.name, address: loc.address, city: loc.city, country: loc.country,
            contact_phone: loc.contact_phone ?? '', contact_email: loc.contact_email ?? '', status: loc.status,
            shift_start_time: loc.shift_start_time ?? '09:00',
            shift_end_time: loc.shift_end_time ?? '18:00',
            max_break_minutes: String(loc.max_break_minutes ?? 30),
            enforce_shift_start_window: loc.enforce_shift_start_window ?? true,
        })
        // Fetch existing gates/zones
        try {
            const res = await fetch(`/api/locations/${loc.id}/gates`)
            const data = await res.json()
            if (data.gates && data.gates.length > 0) {
                setGatesForm(data.gates.map((g: { name: string; zones: { total_slots: number }[] }) => ({
                    name: g.name,
                    zones: g.zones.map((z: { total_slots: number }) => ({ slots: String(z.total_slots) })),
                })))
            } else {
                setGatesForm([{ name: '', zones: [{ slots: '' }] }])
            }
        } catch { setGatesForm([{ name: '', zones: [{ slots: '' }] }]) }
        setWizardStep(0); setFormErrors({}); setModalOpen(true)
    }

    const closeModal = () => { if (saving) return; setModalOpen(false); setTimeout(() => { setEditTarget(null); setBasicForm(defaultBasicForm); setGatesForm([{ name: '', zones: [{ slots: '' }] }]); setWizardStep(0); setFormErrors({}) }, 300) }

    // ─── Validation per step ──────────────────────────────────────────────────
    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {}
        if (step === 0) {
            if (!basicForm.name.trim()) errors.name = 'Name is required'
            if (!basicForm.address.trim()) errors.address = 'Address is required'
            if (!basicForm.city.trim()) errors.city = 'City is required'
            if (basicForm.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicForm.contact_email)) errors.contact_email = 'Invalid email'
        }
        if (step === 1) {
            gatesForm.forEach((g, i) => { if (!g.name.trim()) errors[`gate_${i}`] = 'Gate name is required' })
            const names = gatesForm.map(g => g.name.trim().toLowerCase())
            names.forEach((n, i) => { if (n && names.indexOf(n) !== i) errors[`gate_${i}`] = 'Duplicate gate name' })
        }
        if (step === 2) {
            gatesForm.forEach((g, gi) => {
                if (g.zones.length < 1) errors[`gate_${gi}_zones`] = 'At least 1 zone required'
            })
        }
        if (step === 3) {
            gatesForm.forEach((g, gi) => {
                g.zones.forEach((z, zi) => {
                    if (!z.slots || isNaN(Number(z.slots)) || Number(z.slots) < 1)
                        errors[`gate_${gi}_zone_${zi}_slots`] = 'Min 1 slot'
                })
            })
        }
        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const nextStep = () => { if (validateStep(wizardStep)) setWizardStep(prev => Math.min(prev + 1, 4)) }
    const prevStep = () => setWizardStep(prev => Math.max(prev - 1, 0))

    // ─── Gate/Zone management ─────────────────────────────────────────────────
    const addGate = () => setGatesForm(prev => [...prev, { name: '', zones: [{ slots: '' }] }])
    const removeGate = (i: number) => setGatesForm(prev => prev.filter((_, idx) => idx !== i))
    const updateGateName = (i: number, name: string) => { setGatesForm(prev => prev.map((g, idx) => idx === i ? { ...g, name } : g)); setFormErrors(prev => { const n = { ...prev }; delete n[`gate_${i}`]; return n }) }

    const updateZoneCount = (gi: number, count: number) => {
        setGatesForm(prev => prev.map((g, idx) => {
            if (idx !== gi) return g
            const newZones = Array.from({ length: Math.max(1, count) }, (_, zi) => g.zones[zi] || { slots: '' })
            return { ...g, zones: newZones }
        }))
    }
    const updateZoneSlots = (gi: number, zi: number, slots: string) => {
        setGatesForm(prev => prev.map((g, gIdx) => gIdx !== gi ? g : { ...g, zones: g.zones.map((z, zIdx) => zIdx !== zi ? z : { slots }) }))
        setFormErrors(prev => { const n = { ...prev }; delete n[`gate_${gi}_zone_${zi}_slots`]; return n })
    }

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validateStep(3)) { setWizardStep(3); return }
        setSaving(true)
        try {
            const payload = {
                ...basicForm,
                max_break_minutes: parseInt(basicForm.max_break_minutes, 10) || 30,
                enforce_shift_start_window: basicForm.enforce_shift_start_window,
                gates: gatesForm.map(g => ({ name: g.name.trim(), zones: g.zones.map(z => ({ slots: Number(z.slots) })) })),
            }
            const url = editTarget ? `/api/locations/${editTarget.id}` : '/api/locations'
            const method = editTarget ? 'PUT' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Operation failed')
            showToast('success', editTarget ? 'Location updated!' : 'Location created!')
            closeModal(); fetchLocations()
        } catch (err: unknown) { showToast('error', err instanceof Error ? err.message : 'Something went wrong') }
        finally { setSaving(false) }
    }

    // ─── Delete ───────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return; setDeleting(deleteTarget.id)
        try { const res = await fetch(`/api/locations/${deleteTarget.id}`, { method: 'DELETE' }); const data = await res.json(); if (!res.ok) throw new Error(data.error); showToast('success', data.message ?? 'Deleted'); setDeleteTarget(null); fetchLocations() }
        catch (err: unknown) { showToast('error', err instanceof Error ? err.message : 'Something went wrong') }
        finally { setDeleting(null) }
    }

    // ─── Render: Wizard Steps ─────────────────────────────────────────────────
    const renderStep0 = () => (
        <div className="space-y-4">
            <InputField label="Location Name" icon={Building2} name="name" value={basicForm.name} onChange={e => { setBasicForm(p => ({ ...p, name: e.target.value })); setFormErrors(p => { const n = { ...p }; delete n.name; return n }) }} placeholder="e.g. Centaurus Mall" required />
            {formErrors.name && <p className="text-red-500 text-xs -mt-2">{formErrors.name}</p>}
            <InputField label="Address" icon={MapPin} name="address" value={basicForm.address} onChange={e => { setBasicForm(p => ({ ...p, address: e.target.value })); setFormErrors(p => { const n = { ...p }; delete n.address; return n }) }} placeholder="e.g. F-8 Markaz" required />
            {formErrors.address && <p className="text-red-500 text-xs -mt-2">{formErrors.address}</p>}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <InputField label="City" icon={MapPin} name="city" value={basicForm.city} onChange={e => { setBasicForm(p => ({ ...p, city: e.target.value })); setFormErrors(p => { const n = { ...p }; delete n.city; return n }) }} placeholder="e.g. Islamabad" required />
                    {formErrors.city && <p className="text-red-500 text-xs -mt-2">{formErrors.city}</p>}
                </div>
                <InputField label="Country" icon={Globe} name="country" value={basicForm.country} onChange={e => setBasicForm(p => ({ ...p, country: e.target.value }))} placeholder="Pakistan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Contact Phone" icon={Phone} name="contact_phone" value={basicForm.contact_phone} onChange={e => setBasicForm(p => ({ ...p, contact_phone: e.target.value }))} placeholder="051-1234567" />
                <div>
                    <InputField label="Contact Email" icon={Mail} name="contact_email" type="email" value={basicForm.contact_email} onChange={e => setBasicForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="parking@venue.com" />
                    {formErrors.contact_email && <p className="text-red-500 text-xs -mt-2">{formErrors.contact_email}</p>}
                </div>
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select name="status" value={basicForm.status} onChange={e => setBasicForm(p => ({ ...p, status: e.target.value as BasicFormData['status'] }))}
                        className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="maintenance">Maintenance</option>
                    </select>
                </div>
            </div>

            {/* Shift Configuration */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-sky-500" />
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Shift Configuration</span>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Shift Start Time" icon={Clock} type="time" value={basicForm.shift_start_time}
                            onChange={e => setBasicForm(p => ({ ...p, shift_start_time: e.target.value }))} />
                        <InputField label="Shift End Time" icon={Clock} type="time" value={basicForm.shift_end_time}
                            onChange={e => setBasicForm(p => ({ ...p, shift_end_time: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Max Break Duration
                        </label>
                        <div className="relative">
                            <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="number" min={5} max={120} step={5}
                                value={basicForm.max_break_minutes}
                                onChange={e => setBasicForm(p => ({ ...p, max_break_minutes: e.target.value }))}
                                className="w-full pl-10 pr-16 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">min</span>
                        </div>
                    </div>
                    {/* Enforce start window toggle */}
                    <div className="flex items-start justify-between gap-4 pt-1">
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Enforce Start Window
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Block staff from clocking in more than 1 hour after the shift start time.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setBasicForm(p => ({ ...p, enforce_shift_start_window: !p.enforce_shift_start_window }))}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${basicForm.enforce_shift_start_window ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${basicForm.enforce_shift_start_window ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        Staff cannot exceed the break limit during a shift. These settings apply to all staff at this venue.
                    </p>
                </div>
            </div>
        </div>
    )

    const renderStep1 = () => (
        <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Add as many gates as your location has. Give each gate a name.</p>
            {gatesForm.map((gate, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <DoorOpen className="w-5 h-5 text-violet-500 mt-2.5 shrink-0" />
                    <div className="flex-1">
                        <input value={gate.name} onChange={e => updateGateName(i, e.target.value)} placeholder={`Gate ${i + 1} name (e.g. Food Court)`}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all" />
                        {gate.name.trim() && <p className="text-xs text-violet-500 mt-1">Zone prefix: <strong>{generateZonePrefix(gate.name)}</strong></p>}
                        {formErrors[`gate_${i}`] && <p className="text-red-500 text-xs mt-1">{formErrors[`gate_${i}`]}</p>}
                    </div>
                    {gatesForm.length > 1 && (
                        <button onClick={() => removeGate(i)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors mt-1">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ))}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addGate}
                className="flex items-center gap-2 px-4 py-2.5 w-full justify-center rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 font-semibold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                <Plus className="w-4 h-4" /> Add Another Gate
            </motion.button>
        </div>
    )

    const renderStep2 = () => (
        <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">For each gate, how many parking zones are closest to it?</p>
            {gatesForm.map((gate, gi) => (
                <div key={gi} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 mb-3">
                        <DoorOpen className="w-4 h-4 text-violet-500" />
                        <span className="font-semibold text-slate-800 dark:text-white text-sm">{gate.name || `Gate ${gi + 1}`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-sky-500 shrink-0" />
                        <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Number of zones:</label>
                        <input type="number" min="1" max="50" value={gate.zones.length} onChange={e => updateZoneCount(gi, parseInt(e.target.value) || 1)}
                            className="w-24 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-center font-semibold" />
                    </div>
                    {formErrors[`gate_${gi}_zones`] && <p className="text-red-500 text-xs mt-1">{formErrors[`gate_${gi}_zones`]}</p>}
                </div>
            ))}
        </div>
    )

    const renderStep3 = () => (
        <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">How many parking slots does each zone have?</p>
            {gatesForm.map((gate, gi) => {
                const prefix = generateZonePrefix(gate.name || `G${gi + 1}`)
                return (
                    <div key={gi} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                        <div className="flex items-center gap-2">
                            <DoorOpen className="w-4 h-4 text-violet-500" />
                            <span className="font-semibold text-slate-800 dark:text-white text-sm">{gate.name || `Gate ${gi + 1}`}</span>
                        </div>
                        {gate.zones.map((zone, zi) => (
                            <div key={zi} className="flex items-center gap-3 ml-6">
                                <LayoutGrid className="w-4 h-4 text-sky-500 shrink-0" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-16">{prefix}{zi + 1}</span>
                                <input type="number" min="1" value={zone.slots} onChange={e => updateZoneSlots(gi, zi, e.target.value)} placeholder="Slots"
                                    className="w-24 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-center font-semibold" />
                                <span className="text-xs text-slate-400">slots</span>
                                {formErrors[`gate_${gi}_zone_${zi}_slots`] && <span className="text-red-500 text-xs">{formErrors[`gate_${gi}_zone_${zi}_slots`]}</span>}
                            </div>
                        ))}
                    </div>
                )
            })}
        </div>
    )

    const renderStep4 = () => {
        let totalSlots = 0; let totalZones = 0
        gatesForm.forEach(g => { totalZones += g.zones.length; g.zones.forEach(z => { totalSlots += Number(z.slots) || 0 }) })
        const usedPrefixes: Record<string, number> = {}
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-violet-600">{gatesForm.length}</p><p className="text-xs text-violet-500 font-semibold">Gates</p></div>
                    <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-sky-600">{totalZones}</p><p className="text-xs text-sky-500 font-semibold">Zones</p></div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{totalSlots}</p><p className="text-xs text-emerald-500 font-semibold">Total Slots</p></div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-1">{basicForm.name}</h4>
                    <p className="text-xs text-slate-500">{basicForm.address}, {basicForm.city}</p>
                </div>
                {gatesForm.map((gate, gi) => {
                    let prefix = generateZonePrefix(gate.name || `G${gi + 1}`)
                    if (usedPrefixes[prefix] !== undefined) { usedPrefixes[prefix]++; prefix = prefix + usedPrefixes[prefix] } else { usedPrefixes[prefix] = 0 }
                    return (
                        <div key={gi} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="flex items-center gap-2 mb-2"><DoorOpen className="w-4 h-4 text-violet-500" /><span className="font-semibold text-sm text-slate-800 dark:text-white">{gate.name}</span></div>
                            <div className="ml-6 space-y-1">
                                {gate.zones.map((z, zi) => (
                                    <div key={zi} className="flex items-center gap-2 text-sm">
                                        <Layers className="w-3.5 h-3.5 text-sky-500" />
                                        <span className="font-medium text-slate-600 dark:text-slate-300">{prefix}{zi + 1}</span>
                                        <span className="text-slate-400">→ {z.slots} slots</span>
                                        <span className="text-xs text-slate-400">({prefix}{zi + 1}-001 to {prefix}{zi + 1}-{String(Number(z.slots)).padStart(3, '0')})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="relative">
            <AnimatePresence>{toast && <Toast key="toast" type={toast.type} message={toast.message} onClose={() => setToast(null)} />}</AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Locations</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage parking locations, gates, zones, and slots</p>
                </div>
                {!readOnly && (
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={openAddModal}
                        className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg transition-colors">
                        <Plus className="w-4 h-4" /> Add Location
                    </motion.button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
                {[
                    { label: 'Total Locations', value: locations.length, color: 'sky' },
                    { label: 'Active', value: locations.filter(l => l.status === 'active').length, color: 'emerald' },
                    { label: 'Total Slots', value: locations.reduce((a, l) => a + l.total_slots, 0), color: 'violet' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-1 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.label}</p>
                        <p className={`text-3xl font-extrabold text-${stat.color}-600`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Location Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-sky-500 animate-spin" /></div>
            ) : locations.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
                    <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No locations added yet</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-5">Click &quot;Add Location&quot; to create your first parking site</p>
                    <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors">
                        <Plus className="w-4 h-4" /> Add Location
                    </button>
                </motion.div>
            ) : (
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-5">
                    <AnimatePresence>
                        {locations.map(loc => (
                            <motion.div key={loc.id} variants={cardVariants} layout whileHover={{ y: -3 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                <div className="flex items-start justify-between p-6 pb-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{loc.name}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5" />{loc.address}, {loc.city}{loc.country && loc.country !== 'Pakistan' ? `, ${loc.country}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={loc.status} />
                                        {!readOnly && (
                                            <>
                                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => openEditModal(loc)}
                                                    className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors" title="Edit">
                                                    <Pencil className="w-4 h-4" />
                                                </motion.button>
                                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setDeleteTarget(loc)}
                                                    className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </motion.button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 dark:border-slate-700 mx-6" />
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-slate-100 dark:divide-slate-700 divide-y sm:divide-y-0">
                                    {[
                                        { icon: Hash, label: 'Total Slots', value: loc.total_slots, color: 'text-sky-600' },
                                        { icon: DoorOpen, label: 'Gates', value: loc.gate_count ?? loc.gates, color: 'text-violet-600' },
                                        { icon: Phone, label: 'Phone', value: loc.contact_phone || '—', color: 'text-black dark:text-white' },
                                        { icon: Mail, label: 'Email', value: loc.contact_email || '—', color: 'text-black dark:text-white' },
                                    ].map(({ icon: Icon, label, value, color }) => (
                                        <div key={label} className="flex flex-col gap-0.5 px-6 py-4">
                                            <div className={`flex items-center gap-1.5 ${color}`}><Icon className="w-3.5 h-3.5 shrink-0" /><span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span></div>
                                            <p className={`text-sm font-bold ${color} truncate`} title={String(value)}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ─── Wizard Modal ────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
                            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={closeModal} />
                        <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                                {/* Modal Header */}
                                <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow"><MapPin className="w-5 h-5 text-white" /></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editTarget ? 'Edit Location' : 'Add New Location'}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Step {wizardStep + 1} of 5 — {stepLabels[wizardStep]}</p>
                                        </div>
                                    </div>
                                    <button onClick={closeModal} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Step Indicator + Content */}
                                <div className="px-4 sm:px-8 py-4 sm:py-6 overflow-y-auto max-h-[65vh]">
                                    <StepIndicator current={wizardStep} total={5} labels={stepLabels} />
                                    {wizardStep === 0 && renderStep0()}
                                    {wizardStep === 1 && renderStep1()}
                                    {wizardStep === 2 && renderStep2()}
                                    {wizardStep === 3 && renderStep3()}
                                    {wizardStep === 4 && renderStep4()}
                                </div>
                                {/* Footer Buttons */}
                                <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-t border-slate-100 dark:border-slate-700">
                                    <button onClick={wizardStep === 0 ? closeModal : prevStep} disabled={saving}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm disabled:opacity-50">
                                        {wizardStep === 0 ? 'Cancel' : <><ChevronLeft className="w-4 h-4" /> Back</>}
                                    </button>
                                    {wizardStep < 4 ? (
                                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={nextStep}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg transition-colors text-sm">
                                            Next <ChevronRight className="w-4 h-4" />
                                        </motion.button>
                                    ) : (
                                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={saving}
                                            className="flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg transition-colors text-sm disabled:opacity-70">
                                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> {editTarget ? 'Update Location' : 'Create Location'}</>}
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ─── Delete Confirmation Modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {deleteTarget && (
                    <>
                        <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
                            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
                        <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 text-center">
                                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4"><Trash2 className="w-7 h-7 text-red-500" /></div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Location?</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                    Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteTarget.name}</span>? This will remove all gates, zones, and slots.
                                </p>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setDeleteTarget(null)} disabled={!!deleting}
                                        className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm disabled:opacity-50">
                                        Cancel
                                    </button>
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleDelete} disabled={!!deleting}
                                        className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition-colors text-sm disabled:opacity-70">
                                        {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete</>}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
