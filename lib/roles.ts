// ── Role Definitions ────────────────────────────────────────────────────────
// Central source of truth for all role-based access control.

export type UserRole = 'customer' | 'driver' | 'washer' | 'supervisor' | 'admin';

export type WashType = 'basic' | 'full' | 'premium';

export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// All staff roles that share shift management (clock in/out, breaks, late arrival)
export const STAFF_ROLES: readonly UserRole[] = ['driver', 'washer', 'supervisor'] as const;

// Roles with admin-level dashboard access (overview, staff management, locations)
export const ADMIN_LIKE_ROLES: readonly UserRole[] = ['admin', 'supervisor'] as const;

// Roles using the operational staff dashboard (driver = checkin/checkout, washer = wash tasks)
export const OPERATIONAL_STAFF_ROLES: readonly UserRole[] = ['driver', 'washer'] as const;

// ── Helper Functions ────────────────────────────────────────────────────────

/** Any staff member (driver, washer, supervisor) — eligible for shifts */
export function isStaffRole(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** Admin or supervisor — can access admin dashboard */
export function isAdminLike(role: string): boolean {
  return (ADMIN_LIKE_ROLES as readonly string[]).includes(role);
}

/** Driver or washer — operational floor staff */
export function isOperationalStaff(role: string): boolean {
  return (OPERATIONAL_STAFF_ROLES as readonly string[]).includes(role);
}

/** Returns the dashboard path for a given role */
export function getDashboardPath(role: string): string {
  switch (role) {
    case 'admin':
    case 'supervisor':
      return '/admin';
    case 'driver':
      return '/staff';
    case 'washer':
      return '/washer';
    case 'customer':
      return '/customer';
    default:
      return '/';
  }
}

/** Human-readable role label */
export function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':      return 'Admin';
    case 'supervisor': return 'Supervisor';
    case 'driver':     return 'Driver';
    case 'washer':     return 'Washer';
    case 'customer':   return 'Customer';
    default:           return role;
  }
}

/** Wash type pricing in PKR */
export const WASH_PRICING: Record<WashType, { label: string; cost: number }> = {
  basic:   { label: 'Basic Wash',     cost: 500 },
  full:    { label: 'Full Wash',      cost: 1000 },
  premium: { label: 'Premium Detail', cost: 2000 },
};
