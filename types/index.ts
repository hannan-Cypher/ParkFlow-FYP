export interface User {
  id: number
  email: string
  phone: string
  full_name: string
  role: "customer" | "driver" | "washer" | "supervisor" | "admin"
  loyalty_points?: number
  is_active: boolean
  created_at: string
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
  driver_id?: number
  slot_number?: string
  venue_name?: string
  entry_time: string
  exit_time?: string
  total_hours: number
  total_amount: number
  cleaning_requested: boolean
  cleaning_completed: boolean
  status: "active" | "completed" | "cancelled"
  entry_image_url?: string
  qr_code?: string
  retrieval_status?: string | null
  retrieval_requested_at?: string | null
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

export interface ServiceRequest {
  id: string
  session_id: string
  customer_id: string
  service_type: string
  service_status: "pending" | "in_progress" | "completed" | "cancelled"
  assigned_to: string | null
  service_cost: number | null
  notes: string | null
  wash_type: "basic" | "full" | "premium" | null
  before_photos: string[]
  after_photos: string[]
  vehicle_id: string | null
  venue_id: string | null
  slot_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}