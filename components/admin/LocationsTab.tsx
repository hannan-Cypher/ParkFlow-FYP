'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MapPin,
    Plus,
    Pencil,
    Trash2,
    X,
    CheckCircle,
    AlertCircle,
    Camera,
    Building2,
    Phone,
    Mail,
    Globe,
    Hash,
    Loader2,
    ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
    id: string
    name: string
    address: string
    city: string
    country: string
    total_slots: number
    gates: number
    contact_phone: string | null
    contact_email: string | null
    status: 'active' | 'inactive' | 'maintenance'
    created_at: string
    updated_at: string
}

interface FormData {
    name: string
    address: string
    city: string
    country: string
    total_slots: string
    gates: string
    contact_phone: string
    contact_email: string
    status: 'active' | 'inactive' | 'maintenance'
}

const defaultForm: FormData = {
    name: '',
    address: '',
    city: '',
    country: 'Pakistan',
    total_slots: '',
    gates: '',
    contact_phone: '',
    contact_email: '',
    status: 'active',
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.25 } },
}

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
}

const modalVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.92, y: 30, transition: { duration: 0.2 } },
}

// ─── Helper: Status Badge ─────────────────────────────────────────────────────

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

// ─── Helper: Toast ────────────────────────────────────────────────────────────

interface ToastProps {
    type: 'success' | 'error'
    message: string
    onClose: () => void
}

function Toast({ type, message, onClose }: ToastProps) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000)
        return () => clearTimeout(t)
    }, [onClose])

    return (
        <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-sm ${type === 'success'
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                : 'bg-red-50/90 border-red-200 text-red-800'
                }`}
        >
            {type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="font-medium text-sm">{message}</p>
            <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    )
}

// ─── Helper: Input Field ──────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    icon: React.ElementType
    required?: boolean
}

function InputField({ label, icon: Icon, required, ...rest }: InputProps) {
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    {...rest}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                />
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LocationsTab() {
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Location | null>(null)
    const [form, setForm] = useState<FormData>(defaultForm)
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})

    // Delete confirm state
    const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)

    // Toast
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // ─── Fetch Locations ─────────────────────────────────────────────────────

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/locations')
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setLocations(data.locations ?? [])
        } catch {
            showToast('error', 'Failed to load locations')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLocations()
    }, [fetchLocations])

    // ─── Toast helpers ────────────────────────────────────────────────────────

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message })
    }

    // ─── Form helpers ─────────────────────────────────────────────────────────

    const openAddModal = () => {
        setEditTarget(null)
        setForm(defaultForm)
        setFormErrors({})
        setModalOpen(true)
    }

    const openEditModal = (loc: Location) => {
        setEditTarget(loc)
        setForm({
            name: loc.name,
            address: loc.address,
            city: loc.city,
            country: loc.country,
            total_slots: String(loc.total_slots),
            gates: String(loc.gates),
            contact_phone: loc.contact_phone ?? '',
            contact_email: loc.contact_email ?? '',
            status: loc.status,
        })
        setFormErrors({})
        setModalOpen(true)
    }

    const closeModal = () => {
        if (saving) return
        setModalOpen(false)
        setTimeout(() => {
            setEditTarget(null)
            setForm(defaultForm)
            setFormErrors({})
        }, 300)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setForm((prev) => ({ ...prev, [name]: value }))
        setFormErrors((prev) => ({ ...prev, [name]: undefined }))
    }

    const validate = (): boolean => {
        const errors: Partial<Record<keyof FormData, string>> = {}
        if (!form.name.trim()) errors.name = 'Name is required'
        if (!form.address.trim()) errors.address = 'Address is required'
        if (!form.city.trim()) errors.city = 'City is required'
        if (form.total_slots === '' || isNaN(Number(form.total_slots)) || Number(form.total_slots) < 0)
            errors.total_slots = 'Enter a valid number of parking slots'
        if (form.gates === '' || isNaN(Number(form.gates)) || Number(form.gates) < 1)
            errors.gates = 'Enter a valid number of gates (minimum 1)'
        if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
            errors.contact_email = 'Enter a valid email address'
        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    // ─── Submit (Add / Edit) ──────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return

        setSaving(true)
        try {
            const payload = {
                ...form,
                total_slots: Number(form.total_slots),
                gates: Number(form.gates),
            }

            let res: Response
            if (editTarget) {
                res = await fetch(`/api/locations/${editTarget.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            } else {
                res = await fetch('/api/locations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            }

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Operation failed')

            showToast('success', editTarget ? 'Location updated successfully!' : 'Location added successfully!')
            closeModal()
            fetchLocations()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Something went wrong'
            showToast('error', message)
        } finally {
            setSaving(false)
        }
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleting(deleteTarget.id)
        try {
            const res = await fetch(`/api/locations/${deleteTarget.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Delete failed')
            showToast('success', data.message ?? 'Location deleted')
            setDeleteTarget(null)
            fetchLocations()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Something went wrong'
            showToast('error', message)
        } finally {
            setDeleting(null)
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="relative">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <Toast
                        key="toast"
                        type={toast.type}
                        message={toast.message}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Locations</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Manage parking locations and their camera gate settings
                    </p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Location
                </motion.button>
            </div>

            {/* Stats Strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Locations', value: locations.length, color: 'sky' },
                    {
                        label: 'Active',
                        value: locations.filter((l) => l.status === 'active').length,
                        color: 'emerald',
                    },
                    {
                        label: 'Total Gates',
                        value: locations.reduce((acc, l) => acc + l.gates, 0),
                        color: 'violet',
                    },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className={`bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-1 shadow-sm`}
                    >
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {stat.label}
                        </p>
                        <p className={`text-3xl font-extrabold text-${stat.color}-600`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Location Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                </div>
            ) : locations.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"
                >
                    <MapPin className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No locations added yet</p>
                    <p className="text-sm text-slate-400 mt-1 mb-5">
                        Click &quot;Add Location&quot; to create your first parking site
                    </p>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Location
                    </button>
                </motion.div>
            ) : (
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 gap-5"
                >
                    <AnimatePresence>
                        {locations.map((loc) => (
                            <motion.div
                                key={loc.id}
                                variants={cardVariants}
                                layout
                                whileHover={{ y: -3 }}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                            >
                                {/* Card Top */}
                                <div className="flex items-start justify-between p-6 pb-4">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{loc.name}</h3>
                                            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {loc.address}, {loc.city}
                                                {loc.country && loc.country !== 'Pakistan' ? `, ${loc.country}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={loc.status} />
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => openEditModal(loc)}
                                            className="p-2 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setDeleteTarget(loc)}
                                            className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </motion.button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-slate-100 mx-6" />

                                {/* Stats Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-slate-100 px-0">
                                    {[
                                        {
                                            icon: Hash,
                                            label: 'Parking Slots',
                                            value: loc.total_slots,
                                            color: 'text-sky-600',
                                        },
                                        {
                                            icon: Camera,
                                            label: 'Camera Gates',
                                            value: loc.gates,
                                            color: 'text-violet-600',
                                        },
                                        {
                                            icon: Phone,
                                            label: 'Phone',
                                            value: loc.contact_phone || '—',
                                            color: 'text-slate-700',
                                        },
                                        {
                                            icon: Mail,
                                            label: 'Email',
                                            value: loc.contact_email || '—',
                                            color: 'text-slate-700',
                                        },
                                    ].map(({ icon: Icon, label, value, color }) => (
                                        <div key={label} className="flex flex-col gap-0.5 px-6 py-4">
                                            <div className={`flex items-center gap-1.5 ${color}`}>
                                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                                    {label}
                                                </span>
                                            </div>
                                            <p
                                                className={`text-sm font-bold ${color} truncate`}
                                                title={String(value)}
                                            >
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ─── Add / Edit Modal ─────────────────────────────────────────────────── */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            variants={overlayVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                            onClick={closeModal}
                        />

                        {/* Modal */}
                        <motion.div
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
                                {/* Modal Header */}
                                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-blue-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow">
                                            <MapPin className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900">
                                                {editTarget ? 'Edit Location' : 'Add New Location'}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {editTarget
                                                    ? 'Update the parking location details'
                                                    : 'Fill in the details to add a new parking location'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={closeModal}
                                        disabled={saving}
                                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5 overflow-y-auto max-h-[70vh]">
                                    {/* Row 1 - Name */}
                                    <div>
                                        <InputField
                                            label="Location Name"
                                            icon={Building2}
                                            name="name"
                                            value={form.name}
                                            onChange={handleChange}
                                            placeholder="e.g. Centaurus Mall"
                                            required
                                        />
                                        {formErrors.name && (
                                            <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                                        )}
                                    </div>

                                    {/* Row 2 - Address */}
                                    <div>
                                        <InputField
                                            label="Address"
                                            icon={MapPin}
                                            name="address"
                                            value={form.address}
                                            onChange={handleChange}
                                            placeholder="e.g. F-8 Markaz, Islamabad"
                                            required
                                        />
                                        {formErrors.address && (
                                            <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>
                                        )}
                                    </div>

                                    {/* Row 3 - City + Country */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <InputField
                                                label="City"
                                                icon={MapPin}
                                                name="city"
                                                value={form.city}
                                                onChange={handleChange}
                                                placeholder="e.g. Islamabad"
                                                required
                                            />
                                            {formErrors.city && (
                                                <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>
                                            )}
                                        </div>
                                        <div>
                                            <InputField
                                                label="Country"
                                                icon={Globe}
                                                name="country"
                                                value={form.country}
                                                onChange={handleChange}
                                                placeholder="e.g. Pakistan"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 4 - Slots + Gates */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <InputField
                                                label="Total Parking Slots"
                                                icon={Hash}
                                                name="total_slots"
                                                type="number"
                                                min="0"
                                                value={form.total_slots}
                                                onChange={handleChange}
                                                placeholder="e.g. 150"
                                                required
                                            />
                                            {formErrors.total_slots && (
                                                <p className="text-red-500 text-xs mt-1">{formErrors.total_slots}</p>
                                            )}
                                        </div>

                                        {/* GATES - highlighted field */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                                Number of Camera Gates <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500" />
                                                <input
                                                    type="number"
                                                    name="gates"
                                                    min="1"
                                                    value={form.gates}
                                                    onChange={handleChange}
                                                    placeholder="e.g. 4"
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-violet-300 bg-violet-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all font-semibold"
                                                />
                                            </div>
                                            <p className="text-xs text-violet-600 mt-1">
                                                Number of entry/exit gates where cameras will be installed
                                            </p>
                                            {formErrors.gates && (
                                                <p className="text-red-500 text-xs mt-1">{formErrors.gates}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 5 - Phone + Email */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <InputField
                                                label="Contact Phone"
                                                icon={Phone}
                                                name="contact_phone"
                                                value={form.contact_phone}
                                                onChange={handleChange}
                                                placeholder="e.g. 051-1234567"
                                            />
                                        </div>
                                        <div>
                                            <InputField
                                                label="Contact Email"
                                                icon={Mail}
                                                name="contact_email"
                                                type="email"
                                                value={form.contact_email}
                                                onChange={handleChange}
                                                placeholder="e.g. parking@venue.com"
                                            />
                                            {formErrors.contact_email && (
                                                <p className="text-red-500 text-xs mt-1">{formErrors.contact_email}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 6 - Status */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Status
                                        </label>
                                        <div className="relative">
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            <select
                                                name="status"
                                                value={form.status}
                                                onChange={handleChange}
                                                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all appearance-none"
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                                <option value="maintenance">Maintenance</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            disabled={saving}
                                            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <motion.button
                                            type="submit"
                                            disabled={saving}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            className="flex items-center gap-2 px-7 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg transition-colors text-sm disabled:opacity-70"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    {editTarget ? 'Updating...' : 'Adding...'}
                                                </>
                                            ) : (
                                                <>
                                                    {editTarget ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                    {editTarget ? 'Update Location' : 'Add Location'}
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ─── Delete Confirmation Modal ────────────────────────────────────────── */}
            <AnimatePresence>
                {deleteTarget && (
                    <>
                        <motion.div
                            variants={overlayVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                            onClick={() => !deleting && setDeleteTarget(null)}
                        />
                        <motion.div
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                        >
                            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
                                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="w-7 h-7 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Location?</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Are you sure you want to delete{' '}
                                    <span className="font-semibold text-slate-800">{deleteTarget.name}</span>? This
                                    action cannot be undone and will remove all associated data.
                                </p>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setDeleteTarget(null)}
                                        disabled={!!deleting}
                                        className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleDelete}
                                        disabled={!!deleting}
                                        className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow transition-colors text-sm disabled:opacity-70"
                                    >
                                        {deleting === deleteTarget.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </>
                                        )}
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
