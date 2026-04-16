'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus,
  Users,
  Send,
  X,
  CheckCircle,
  MessageCircle,
  RefreshCw,
  UserX,
  Loader2,
  MapPin,
  Clock,
  Calendar,
  ChevronUp,
  ChevronDown,
  Coffee,
  TrendingUp,
  Search,
  AlertTriangle,
  XCircle,
  LayoutGrid,
  Building2,
} from 'lucide-react'
import { buildWhatsAppStaffInviteLink } from '@/lib/whatsapp'
import { useRealtime } from '@/hooks/useRealtime'

// ── Types ──────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string | null
  status: 'active' | 'pending' | 'deactivated'
  on_duty: boolean
  created_at: string
  venue_id: string | null
  venue_name: string | null
  zone_id: string | null
  zone_name: string | null
  invited_at: string | null
  invited_by_name: string | null
}

interface DutyStaff {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: string
}

interface DutyZone {
  id: string
  name: string
  total_slots: number
  staff: DutyStaff[]
}

interface DutyGate {
  id: string
  name: string
  zones: DutyZone[]
}

interface DutyVenue {
  id: string
  name: string
  supervisor: DutyStaff | null
  gates: DutyGate[]
  unassigned_staff: DutyStaff[]
}

interface Venue {
  id: string
  name: string
}

interface Toast {
  id: number
  message: string
}

interface PendingShift {
  id: string
  shift_start: string
  late_minutes: number
  is_late: boolean
  staff_id: string
  full_name: string | null
  email: string
  phone: string | null
  venue_id: string
  venue_name: string
}

interface ShiftRecord {
  id: string
  shift_start: string
  shift_end: string | null
  status: 'active' | 'on_break' | 'completed'
  total_break_minutes: number
  total_minutes: number | null
  net_minutes: number | null
  venue_name: string
}

// ── Animation variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

// ── Avatar gradients ───────────────────────────────────────────────────────

const GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-teal-500 to-green-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-red-500',
]

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Role badge ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null
  const config: Record<string, { bg: string; text: string }> = {
    driver: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    washer: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    supervisor: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  }
  const style = config[role.toLowerCase()] ?? { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
      {role}
    </span>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status, onDuty }: { status: StaffMember['status']; onDuty: boolean }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending
      </span>
    )
  }
  if (status === 'deactivated') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Deactivated
      </span>
    )
  }
  // active — show shift duty state
  if (onDuty) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        On Duty
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Off Duty
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface StaffTabProps {
  isSupervisor?: boolean
  supervisorVenueId?: string
  supervisorName?: string
  venueName?: string
}

export default function StaffTab({
  isSupervisor = false,
  supervisorVenueId,
  supervisorName,
  venueName
}: StaffTabProps) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'deactivated'>('all')
  const [venueFilter, setVenueFilter] = useState('')

  // Set default venue filter for supervisors
  useEffect(() => {
    if (isSupervisor && supervisorVenueId) {
      setVenueFilter(supervisorVenueId)
      setSelectedDutyVenueId(supervisorVenueId)
    }
  }, [isSupervisor, supervisorVenueId])
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null)
  const [shiftHistories, setShiftHistories] = useState<Record<string, ShiftRecord[]>>({})
  const [loadingShifts, setLoadingShifts] = useState<string | null>(null)
  const [pendingShifts, setPendingShifts] = useState<PendingShift[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Duty board state
  const [showDutyBoard, setShowDutyBoard] = useState(false)
  const [dutyVenues, setDutyVenues] = useState<DutyVenue[]>([])
  const [selectedDutyVenueId, setSelectedDutyVenueId] = useState<string>('')
  const [loadingDutyBoard, setLoadingDutyBoard] = useState(false)
  const [zoneAssignPopover, setZoneAssignPopover] = useState<string | null>(null)

  // Modal form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteVenueId, setInviteVenueId] = useState('')
  const [inviteRole, setInviteRole] = useState<'driver' | 'washer' | 'supervisor'>('driver')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  // ── Toast helpers ────────────────────────────────────────────────────────

  const addToast = useCallback((message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // ── Fetch data ───────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff')
      if (res.ok) {
        const data = await res.json()
        setStaff(data.staff)
      }
    } catch {
      // silent
    } finally {
      setLoadingStaff(false)
    }
  }, [])

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/venues')
      if (res.ok) {
        const data = await res.json()
        setVenues(data.venues)
      }
    } catch {
      // silent
    }
  }, [])

  const fetchPendingShifts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/approve-shift')
      if (res.ok) {
        const data = await res.json()
        setPendingShifts(data.pendingShifts ?? [])
      } else {
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        console.error('fetchPendingShifts failed:', res.status, await res.text())
      }
    } catch (err) {
      console.error('fetchPendingShifts error:', err)
    }
  }, [])

  const handleApproveShift = useCallback(async (shiftId: string, action: 'approve' | 'reject') => {
    setApprovingId(shiftId)
    try {
      const res = await fetch('/api/admin/approve-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, action }),
      })
      if (res.ok) {
        const data = await res.json()
        addToast(data.message || (action === 'approve' ? 'Shift approved' : 'Shift rejected'))
        await fetchPendingShifts()
        await fetchStaff()
      } else {
        const data = await res.json()
        addToast(data.error || 'Failed to update shift')
      }
    } catch {
      addToast('Network error. Please try again.')
    } finally {
      setApprovingId(null)
    }
  }, [fetchPendingShifts, fetchStaff, addToast])

  const fetchShiftHistory = useCallback(async (staffId: string) => {
    setLoadingShifts(staffId)
    try {
      const res = await fetch(`/api/admin/shifts?staff_id=${staffId}`)
      if (res.ok) {
        const data = await res.json()
        setShiftHistories(prev => ({ ...prev, [staffId]: data.shifts ?? [] }))
      }
    } catch {
      // silent
    } finally {
      setLoadingShifts(null)
    }
  }, [])

  const toggleShiftHistory = useCallback((staffId: string) => {
    if (expandedShiftId === staffId) {
      setExpandedShiftId(null)
    } else {
      setExpandedShiftId(staffId)
      if (!shiftHistories[staffId]) fetchShiftHistory(staffId)
    }
  }, [expandedShiftId, shiftHistories, fetchShiftHistory])

  useEffect(() => {
    fetchStaff()
    fetchVenues()
    fetchPendingShifts()
  }, [fetchStaff, fetchVenues, fetchPendingShifts])

  useEffect(() => {
    fetchStaff()
    fetchVenues()
    fetchPendingShifts()
  }, [fetchStaff, fetchVenues, fetchPendingShifts])

  // ── Open modal ───────────────────────────────────────────────────────────

  function openModal(email = '') {
    setInviteEmail(email)
    setInviteName('')
    setInvitePhone('')
    setInviteVenueId('')
    setInviteRole('driver')
    setInviteError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
  }

  // ── Send invitation ──────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)

    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }
    if (!invitePhone.trim()) {
      setInviteError('WhatsApp phone number is required to send the invite')
      return
    }

    // Open window synchronously to bypass Safari/Chrome popup blockers
    const waWindow = window.open('', '_blank')
    setInviteLoading(true)
    try {
      const res = await fetch('/api/admin/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || null,
          phone: invitePhone,
          venue_id: inviteVenueId || null,
          staff_role: inviteRole,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (waWindow) waWindow.close()
        setInviteError(data.error || 'Failed to create invitation')
        return
      }

      // Automatically use the ngrok URL so WhatsApp formats the text as a clickable blue hyperlink
      let safeLink = data.magicLink;
      if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
        safeLink = safeLink.replace('http://localhost:3000', 'https://ductless-case-overproficiently.ngrok-free.dev');
      }

      // Build WhatsApp link and explicitly map the new popup window to the wa.me schema
      const waLink = buildWhatsAppStaffInviteLink(invitePhone, inviteName || null, safeLink)
      if (waWindow) {
        waWindow.location.href = waLink
      } else {
        window.open(waLink, '_blank')
      }

      closeModal()
      addToast(`Invitation created for ${inviteEmail}`)
      await fetchStaff()
    } catch {
      if (waWindow) waWindow.close()
      setInviteError('Network error. Please try again.')
    } finally {
      setInviteLoading(false)
    }
  }

  // ── Resend invitation ────────────────────────────────────────────────────

  async function handleResend(member: StaffMember) {
    // Open window synchronously to bypass Safari/Chrome popup blockers
    let waWindow: Window | null = null;
    if (member.phone) {
      waWindow = window.open('', '_blank');
    }

    setActionLoading(member.id)
    try {
      const res = await fetch('/api/admin/staff/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (waWindow) waWindow.close()
        addToast(data.error || 'Failed to resend invitation')
        return
      }

      if (member.phone) {
        let safeLink = data.magicLink;
        if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
          safeLink = safeLink.replace('http://localhost:3000', 'https://ductless-case-overproficiently.ngrok-free.dev');
        }

        const waLink = buildWhatsAppStaffInviteLink(member.phone, data.name, safeLink)
        if (waWindow) {
          waWindow.location.href = waLink
        } else {
          window.open(waLink, '_blank')
        }
        addToast(`New invitation link sent via WhatsApp to ${member.email}`)
      } else {
        // No phone on file — open modal with email prefilled
        openModal(member.email)
        addToast('No phone on file — enter their number to send via WhatsApp')
      }
    } catch {
      if (waWindow) waWindow.close()
      addToast('Network error. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Deactivate staff ─────────────────────────────────────────────────────

  async function handleDeactivate(member: StaffMember) {
    if (!confirm(`Deactivate ${member.full_name || member.email}? They will be logged out immediately.`)) return

    setActionLoading(member.id)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: member.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        addToast(data.error || 'Failed to deactivate')
        return
      }

      addToast(`${member.full_name || member.email} has been deactivated`)
      await fetchStaff()
    } catch {
      addToast('Network error. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Assign venue + zone ──────────────────────────────────────────────────

  async function handleAssignVenue(staffId: string, venueId: string | null) {
    setAssigningId(staffId)
    try {
      const res = await fetch('/api/staff/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, venue_id: venueId, zone_id: null }),
      })
      if (res.ok) {
        await fetchStaff()
        if (showDutyBoard) fetchDutyBoard()
      } else {
        const data = await res.json()
        addToast(data.error || 'Failed to assign venue')
      }
    } catch {
      addToast('Failed to update venue assignment')
    } finally {
      setAssigningId(null)
    }
  }

  // ── Duty Board ──────────────────────────────────────────────────────────

  const fetchDutyBoard = useCallback(async () => {
    setLoadingDutyBoard(true)
    try {
      const res = await fetch('/api/admin/staff/duty-assignments')
      if (res.ok) {
        const data = await res.json()
        setDutyVenues(data.venues ?? [])
        // Auto-select first venue if none selected
        if (!selectedDutyVenueId && data.venues?.length > 0) {
          setSelectedDutyVenueId(data.venues[0].id)
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingDutyBoard(false)
    }
  }, [selectedDutyVenueId])

  // Real-time updates via SSE
  useRealtime(useCallback((event) => {
    if (event.table === 'users' || event.table === 'parking_sessions') {
      fetchStaff();
      fetchPendingShifts();
      if (showDutyBoard) fetchDutyBoard();
    }
  }, [fetchStaff, fetchPendingShifts, fetchDutyBoard, showDutyBoard]), ['users', 'parking_sessions']);

  async function handleZoneAssign(staffId: string, venueId: string, zoneId: string) {
    setAssigningId(staffId)
    try {
      const res = await fetch('/api/staff/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, venue_id: venueId, zone_id: zoneId }),
      })
      if (res.ok) {
        addToast('Staff assigned to zone')
        setZoneAssignPopover(null)
        await fetchDutyBoard()
        await fetchStaff()
      } else {
        const data = await res.json()
        addToast(data.error || 'Failed to assign')
      }
    } catch {
      addToast('Network error')
    } finally {
      setAssigningId(null)
    }
  }

  async function handleZoneUnassign(staffId: string, venueId: string) {
    setAssigningId(staffId)
    try {
      const res = await fetch('/api/staff/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, venue_id: venueId, zone_id: null }),
      })
      if (res.ok) {
        addToast('Staff unassigned from zone')
        await fetchDutyBoard()
        await fetchStaff()
      } else {
        const data = await res.json()
        addToast(data.error || 'Failed to unassign')
      }
    } catch {
      addToast('Network error')
    } finally {
      setAssigningId(null)
    }
  }

  async function handleSupervisorAssign(staffId: string, venueId: string | null) {
    setAssigningId(staffId)
    try {
      const res = await fetch('/api/staff/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, venue_id: venueId, zone_id: null }),
      })
      if (res.ok) {
        addToast('Supervisor assigned to venue')
        await fetchDutyBoard()
        await fetchStaff()
      } else {
        const data = await res.json()
        addToast(data.error || 'Failed to assign supervisor')
      }
    } catch {
      addToast('Network error')
    } finally {
      setAssigningId(null)
    }
  }

  const selectedDutyVenue = useMemo(
    () => dutyVenues.find(v => v.id === selectedDutyVenueId) ?? null,
    [dutyVenues, selectedDutyVenueId]
  )

  const availableSupervisors = useMemo(
    () => staff.filter(s => s.role === 'supervisor' && s.status === 'active'),
    [staff]
  )

  // ── Stats (always from full list, not filtered) ───────────────────────────

  const activeCount = staff.filter((s) => s.status === 'active').length
  const pendingCount = staff.filter((s) => s.status === 'pending').length
  const deactivatedCount = staff.filter((s) => s.status === 'deactivated').length

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredStaff = useMemo(() => {
    return staff.filter((m) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !q ||
        (m.full_name?.toLowerCase().includes(q) ?? false) ||
        m.email.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter
      const matchesVenue = !venueFilter || m.venue_id === venueFilter
      return matchesSearch && matchesStatus && matchesVenue
    })
  }, [staff, searchQuery, statusFilter, venueFilter])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 shadow-md max-w-sm"
            >
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl dark:text-slate-100 font-bold text-slate-800">
            Staff Management {isSupervisor && venueName ? `— ${venueName}` : ''}
          </h2>
          <p className="dark:text-slate-500 text-sm mt-0.5">
            {isSupervisor
              ? `Team at ${venueName || 'your assigned location'}`
              : 'Invite and manage your valet team'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoadingStaff(true); fetchStaff(); fetchPendingShifts() }}
            disabled={loadingStaff}
            className="p-2.5 border border-gray-200 dark:border-slate-700 text-slate-500 hover:text-sky-600 hover:border-sky-300 rounded-xl transition-all disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStaff ? 'animate-spin' : ''}`} />
          </button>
          {!isSupervisor && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-all text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Invite New Staff
            </button>
          )}
        </div>
      </div>

      {/* Unassigned Supervisor Notice */}
      {isSupervisor && !supervisorVenueId && (
        <div className="mb-6 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-2">No Venue Assigned</h3>
          <p className="text-amber-700 dark:text-amber-300 max-w-md">
            You are not currently assigned to any venue. Please contact your administrator to assign you to a location so you can manage your team.
          </p>
        </div>
      )}

      {/* Late Arrivals — pending admin approval */}
      <AnimatePresence>
        {pendingShifts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-3 border-b border-red-200 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                Late Arrivals ({pendingShifts.length})
              </span>
              <span className="text-xs text-red-500 dark:text-red-500 ml-1">— awaiting your approval</span>
            </div>
            <div className="divide-y divide-red-100 dark:divide-red-900/40">
              {pendingShifts.map((ps) => (
                <div key={ps.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                      {ps.full_name || ps.email}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="text-red-500 font-medium">{ps.late_minutes} min late</span>
                      {' · '}{ps.venue_name}
                      {' · '}Clocked in at {new Date(ps.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApproveShift(ps.id, 'approve')}
                      disabled={approvingId === ps.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                      {approvingId === ps.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Allow Shift
                    </button>
                    <button
                      onClick={() => handleApproveShift(ps.id, 'reject')}
                      disabled={approvingId === ps.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                      {approvingId === ps.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Duty Board ────────────────────────────────────────────────── */}
      <div className="mb-5">
        <button
          onClick={() => {
            const next = !showDutyBoard
            setShowDutyBoard(next)
            if (next && dutyVenues.length === 0) fetchDutyBoard()
          }}
          className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all ${showDutyBoard
            ? 'bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 border-sky-200 dark:border-sky-800'
            : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-sky-200 dark:hover:border-sky-700'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${showDutyBoard
              ? 'bg-sky-500 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
              <LayoutGrid className="w-4.5 h-4.5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Duty Assignment Board</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Assign drivers & washers to zones</p>
            </div>
          </div>
          {showDutyBoard ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {showDutyBoard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5">
                {/* Venue selector */}
                <div className="flex items-center gap-3 mb-5">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {isSupervisor ? (
                    <div className="flex-1 px-3 py-2 rounded-xl border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 text-sm font-semibold">
                      {venueName || 'Loading location...'}
                    </div>
                  ) : (
                    <select
                      value={selectedDutyVenueId}
                      onChange={(e) => setSelectedDutyVenueId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                    >
                      <option value="">Select a venue...</option>
                      {dutyVenues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={fetchDutyBoard}
                    disabled={loadingDutyBoard}
                    className="p-2 border border-gray-200 dark:border-slate-600 text-slate-400 hover:text-sky-500 rounded-lg transition-all disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDutyBoard ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingDutyBoard && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
                  </div>
                )}

                {!loadingDutyBoard && selectedDutyVenue && (
                  <>
                    {/* Supervisor row — admin only */}
                    {!isSupervisor && (
                      <div className="mb-5 p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              Supervisor
                            </span>
                            {selectedDutyVenue.supervisor ? (
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {selectedDutyVenue.supervisor.full_name || selectedDutyVenue.supervisor.email}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400 italic">No supervisor assigned</span>
                            )}
                          </div>
                          <select
                            value={selectedDutyVenue.supervisor?.id ?? ''}
                            onChange={(e) => {
                              const newSupervisorId = e.target.value
                              if (newSupervisorId) {
                                handleSupervisorAssign(newSupervisorId, selectedDutyVenue.id)
                              } else if (selectedDutyVenue.supervisor?.id) {
                                // Unassign the current supervisor
                                handleSupervisorAssign(selectedDutyVenue.supervisor.id, null)
                              }
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer focus:ring-2 focus:ring-purple-400/20 outline-none"
                          >
                            <option value="">Assign supervisor...</option>
                            {availableSupervisors.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Gates → Zones grid */}
                    {selectedDutyVenue.gates.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No gates/zones configured for this venue</p>
                        <p className="text-xs text-slate-300 dark:text-slate-500 mt-1">Set up the venue structure in the Locations tab first</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedDutyVenue.gates.map(gate => (
                          <div key={gate.id}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-1">
                              {gate.name}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {gate.zones.map(zone => (
                                <div
                                  key={zone.id}
                                  className="border border-gray-100 dark:border-slate-700 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/50 hover:border-sky-200 dark:hover:border-sky-800 transition-all"
                                >
                                  {/* Zone header */}
                                  <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{zone.name}</span>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{zone.total_slots} slots</span>
                                    </div>
                                    {/* Add button */}
                                    <div className="relative">
                                      <button
                                        onClick={() => setZoneAssignPopover(zoneAssignPopover === zone.id ? null : zone.id)}
                                        className="p-1 text-slate-300 dark:text-slate-600 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-md transition-all"
                                        title="Assign staff"
                                      >
                                        <UserPlus className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Assign popover */}
                                      {zoneAssignPopover === zone.id && (
                                        <div className="absolute right-0 top-8 z-30 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl p-2 max-h-48 overflow-y-auto">
                                          {selectedDutyVenue.unassigned_staff.length === 0 ? (
                                            <p className="text-xs text-slate-400 p-2 text-center">No unassigned staff at this venue</p>
                                          ) : (
                                            selectedDutyVenue.unassigned_staff.map(s => (
                                              <button
                                                key={s.id}
                                                onClick={() => handleZoneAssign(s.id, selectedDutyVenue.id, zone.id)}
                                                disabled={assigningId === s.id}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 text-left transition-colors disabled:opacity-40"
                                              >
                                                {assigningId === s.id ? (
                                                  <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin flex-shrink-0" />
                                                ) : (
                                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.role === 'driver' ? 'bg-sky-500' : 'bg-emerald-500'
                                                    }`} />
                                                )}
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                                  {s.full_name || s.email}
                                                </span>
                                                <span className={`ml-auto text-[10px] font-semibold uppercase ${s.role === 'driver' ? 'text-sky-500' : 'text-emerald-500'
                                                  }`}>
                                                  {s.role}
                                                </span>
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Assigned staff */}
                                  {zone.staff.length === 0 ? (
                                    <p className="text-[11px] text-slate-300 dark:text-slate-600 italic">No staff assigned</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {zone.staff.map(s => (
                                        <div
                                          key={s.id}
                                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600"
                                        >
                                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.role === 'driver' ? 'bg-sky-500' : 'bg-emerald-500'
                                            }`} />
                                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                                            {s.full_name || s.email}
                                          </span>
                                          <span className={`text-[10px] font-semibold uppercase ${s.role === 'driver' ? 'text-sky-400' : 'text-emerald-400'
                                            }`}>
                                            {s.role}
                                          </span>
                                          <button
                                            onClick={() => handleZoneUnassign(s.id, selectedDutyVenue.id)}
                                            disabled={assigningId === s.id}
                                            className="p-0.5 text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors disabled:opacity-40"
                                            title="Unassign from zone"
                                          >
                                            {assigningId === s.id
                                              ? <Loader2 className="w-3 h-3 animate-spin" />
                                              : <X className="w-3 h-3" />}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unassigned pool */}
                    {selectedDutyVenue.unassigned_staff.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-2 px-1">
                          Unassigned at {selectedDutyVenue.name} ({selectedDutyVenue.unassigned_staff.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedDutyVenue.unassigned_staff.map(s => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${s.role === 'driver' ? 'bg-sky-500' : 'bg-emerald-500'
                                }`} />
                              {s.full_name || s.email}
                              <span className="text-amber-400 dark:text-amber-500 uppercase text-[9px]">{s.role}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!loadingDutyBoard && !selectedDutyVenueId && (
                  <div className="text-center py-8">
                    <Building2 className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Select a venue to manage duty assignments</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats row — clickable to filter */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {([
          { label: 'Active', value: 'active' as const, count: activeCount, dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
          { label: 'Pending', value: 'pending' as const, count: pendingCount, dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-400' },
          { label: 'Deactivated', value: 'deactivated' as const, count: deactivatedCount, dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', ring: 'ring-gray-400' },
        ]).map(({ label, value, count, dot, text, bg, ring }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(statusFilter === value ? 'all' : value)}
            className={`${bg} rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all text-left ${statusFilter === value ? `ring-2 ${ring}` : 'hover:brightness-95'
              }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
            <div>
              <p className={`text-2xl font-bold ${text}`}>{count}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or email..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(['all', 'active', 'pending', 'deactivated'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${statusFilter === s
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
            >
              {s === 'all' ? `All (${staff.length})` : s}
            </button>
          ))}
        </div>

        {/* Venue filter — hide for supervisors */}
        {venues.length > 0 && !isSupervisor && (
          <select
            value={venueFilter}
            onChange={(e) => setVenueFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all flex-shrink-0"
          >
            <option value="">All Venues</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Result count */}
      {(searchQuery || statusFilter !== 'all' || venueFilter) && (
        <p className="text-xs text-slate-400 mb-3">
          Showing {filteredStaff.length} of {staff.length} staff
          {(searchQuery || statusFilter !== 'all' || venueFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setVenueFilter('') }}
              className="ml-2 text-sky-500 hover:text-sky-600 font-medium"
            >
              Clear filters
            </button>
          )}
        </p>
      )}

      {/* Staff list */}
      {loadingStaff ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          {staff.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No staff members yet</h3>
              <p className="text-slate-400 text-sm mb-5">
                {isSupervisor ? 'No team members have been added' : 'Invite your first team member to get started'}
              </p>
              {!isSupervisor && (
                <button
                  onClick={() => openModal()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-all text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Staff
                </button>
              )}
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No results found</h3>
              <p className="text-slate-400 text-sm mb-4">Try adjusting your search or filters</p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setVenueFilter('') }}
                className="text-sky-500 hover:text-sky-600 text-sm font-medium"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {filteredStaff.map((member, index) => (
            <motion.div
              key={member.id}
              variants={itemVariants}
              className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="p-5 flex items-center gap-4">
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-white font-bold text-sm">
                    {getInitials(member.full_name, member.email)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {member.full_name || '—'}
                    </p>
                    <StatusBadge status={member.status} onDuty={member.on_duty} />
                    <RoleBadge role={member.role} />
                  </div>
                  <p className="text-slate-400 text-sm truncate">{member.email}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {/* Inline venue + zone display */}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      {assigningId === member.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                      ) : (
                        <div className="flex items-center gap-1">
                          {isSupervisor ? (
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              {member.venue_name || 'No Venue'}
                            </span>
                          ) : (
                            <select
                              value={member.venue_id ?? ''}
                              onChange={(e) => handleAssignVenue(member.id, e.target.value || null)}
                              disabled={assigningId === member.id}
                              className="text-xs text-slate-600 dark:text-slate-300 bg-transparent border-0 outline-none cursor-pointer hover:text-sky-600 transition-colors pr-1 appearance-none"
                            >
                              <option value="">Unassigned</option>
                              {venues.map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          )}
                          {member.zone_name && (
                            <span className="text-xs text-sky-500 dark:text-sky-400 font-medium">
                              → {member.zone_name}
                            </span>
                          ) || (isSupervisor && member.venue_id && (
                            <span className="text-xs text-slate-400 font-medium italic">
                              (No Duty)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-slate-200 text-xs">•</span>
                    <p className="text-slate-300 text-xs">
                      Invited {formatDate(member.invited_at || member.created_at)}
                      {member.invited_by_name && ` by ${member.invited_by_name}`}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Shift history toggle */}
                  <button
                    onClick={() => toggleShiftHistory(member.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${expandedShiftId === member.id
                      ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-sky-300 hover:text-sky-600'
                      }`}
                  >
                    {loadingShifts === member.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : expandedShiftId === member.id ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    Shifts
                  </button>

                  {member.status === 'pending' && (
                    <button
                      onClick={() => handleResend(member)}
                      disabled={actionLoading === member.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-300 text-sky-600 hover:bg-sky-50 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {actionLoading === member.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5" />
                      )}
                      Resend via WhatsApp
                    </button>
                  )}
                  {member.status === 'active' && !isSupervisor && (
                    <button
                      onClick={() => handleDeactivate(member)}
                      disabled={actionLoading === member.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {actionLoading === member.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserX className="w-3.5 h-3.5" />
                      )}
                      Deactivate
                    </button>
                  )}
                  {member.status === 'deactivated' && !isSupervisor && (
                    <button
                      onClick={() => openModal(member.email)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-300 text-sky-600 hover:bg-sky-50 rounded-lg text-xs font-medium transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-invite
                    </button>
                  )}
                </div>
              </div>{/* end p-5 flex row */}

              {/* Shift history panel */}
              <AnimatePresence>
                {expandedShiftId === member.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-700"
                  >
                    {loadingShifts === member.id ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
                      </div>
                    ) : !shiftHistories[member.id] || shiftHistories[member.id].length === 0 ? (
                      <div className="text-center py-6">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No shift records yet</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                              <th className="px-4 py-2.5 text-left font-semibold">Clock In</th>
                              <th className="px-4 py-2.5 text-left font-semibold">Clock Out</th>
                              <th className="px-4 py-2.5 text-left font-semibold flex items-center gap-1"><Coffee className="w-3 h-3" /> Break</th>
                              <th className="px-4 py-2.5 text-left font-semibold">Net Worked</th>
                              <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftHistories[member.id].map((shift) => {
                              const fmtTime = (iso: string | null) =>
                                iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
                              const fmtDate = (iso: string) =>
                                new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })
                              const fmtMin = (m: number | null) => {
                                if (m === null) return '—'
                                const h = Math.floor(m / 60), mins = m % 60
                                return h > 0 ? `${h}h ${mins}m` : `${mins}m`
                              }
                              const statusConfig = {
                                completed: { dot: 'bg-slate-400', text: 'text-slate-500', label: 'Done' },
                                active: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Active' },
                                on_break: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'On Break' },
                              }[shift.status]
                              return (
                                <tr key={shift.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmtDate(shift.shift_start)}</td>
                                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{fmtTime(shift.shift_start)}</td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmtTime(shift.shift_end)}</td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{shift.total_break_minutes}m</td>
                                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-sky-500" />{fmtMin(shift.net_minutes)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusConfig.text}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                      {statusConfig.label}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Invite Staff Member</h3>
                  <p className="text-slate-500 text-sm mt-0.5">
                    A magic link will be sent via WhatsApp
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Staff Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="staff@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
                  />
                </div>

                {/* Phone — required for WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    WhatsApp Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="03XX-XXXXXXX"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    The invitation link will be sent to this WhatsApp number
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Full Name{' '}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g., Ahmed Khan"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    They can change this when they activate their account
                  </p>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Staff Role <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteRole('driver')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${inviteRole === 'driver'
                        ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500/30'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                    >
                      <p className={`text-sm font-semibold ${inviteRole === 'driver' ? 'text-sky-700' : 'text-slate-700'}`}>
                        Driver
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Parking &amp; valet</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole('washer')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${inviteRole === 'washer'
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                    >
                      <p className={`text-sm font-semibold ${inviteRole === 'washer' ? 'text-emerald-700' : 'text-slate-700'}`}>
                        Washer
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Car wash &amp; cleaning</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole('supervisor')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${inviteRole === 'supervisor'
                        ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500/30'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                    >
                      <p className={`text-sm font-semibold ${inviteRole === 'supervisor' ? 'text-purple-700' : 'text-slate-700'}`}>
                        Supervisor
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Staff oversight</p>
                    </button>
                  </div>
                </div>

                {/* Venue */}
                {venues.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Assign to Venue{' '}
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={inviteVenueId}
                      onChange={(e) => setInviteVenueId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800 bg-white"
                    >
                      <option value="">— No venue assigned —</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Error */}
                <AnimatePresence>
                  {inviteError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-500 text-sm"
                    >
                      {inviteError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 border border-gray-200 text-slate-600 hover:bg-gray-50 font-medium rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inviteLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send via WhatsApp
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
