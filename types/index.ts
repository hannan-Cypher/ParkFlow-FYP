export interface User {
  id: number
  email: string
  phone: string
  full_name: string
  role: "customer" | "valet_staff" | "admin" | "super_admin"
  tenant_id?: number
  loyalty_points?: number
  is_active: boolean
  created_at: string
}

export interface Tenant {
  id: number
  name: string
  subdomain: string
  address: string
  phone: string
  email: string
  subscription_plan: "basic" | "premium" | "enterprise"
  subscription_status: "trial" | "active" | "suspended"
  total_slots: number
  is_active: boolean
}

export interface Vehicle {
  id: number
  license_plate: string
  make?: string
  model?: string
  color?: string
  year?: number
  owner_id: number
  created_at: string
}

export interface ParkingSession {
  id: number
  license_plate: string
  vehicle_id?: number
  customer_id: number
  valet_staff_id?: number
  slot_number?: string
  entry_time: string
  exit_time?: string
  total_hours: number
  total_amount: number
  cleaning_requested: boolean
  cleaning_completed: boolean
  status: "active" | "completed" | "cancelled"
  entry_image_url?: string
}

export interface ANPRResult {
  success: boolean
  plate_detected: boolean
  confidence: number
  plate_text: string
  bbox?: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}