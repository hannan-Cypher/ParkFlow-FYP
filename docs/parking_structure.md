# ParkFlow — Parking Structure Architecture

This document explains how **Venues**, **Floor Levels**, **Zones**, **Slot Types**, and **Vehicle Types** relate to each other in ParkFlow.

---

## 1. Entity Relationship Overview

```mermaid
erDiagram
    VENUE ||--o{ PARKING_SLOT : "has many"
    VENUE ||--o{ PARKING_SESSION : "hosts"
    VEHICLE ||--o{ PARKING_SESSION : "parks in"
    PARKING_SLOT ||--o{ PARKING_SESSION : "assigned to"
    USER ||--o{ PARKING_SESSION : "customer"
    USER ||--o{ PARKING_SESSION : "valet staff"

    VENUE {
        uuid id PK
        string name
        string address
        string city
        int total_slots
        int gates
    }

    PARKING_SLOT {
        uuid id PK
        uuid venue_id FK
        string slot_number
        string floor_level
        string zone
        string slot_type
        string status
    }

    PARKING_SESSION {
        uuid id PK
        uuid vehicle_id FK
        uuid venue_id FK
        uuid slot_id FK
        timestamp entry_time
        timestamp exit_time
        string status
    }

    VEHICLE {
        uuid id PK
        string license_plate
        string vehicle_type
        string make
        string model
    }
```

---

## 2. Hierarchy: Venue → Floor → Zone → Slot

Every parking slot lives inside a **venue** and is organized into a **floor level** and a **zone**. Each slot also has a **slot type** that determines which vehicle types prefer it.

```mermaid
graph TD
    V["🏢 VENUE"]
    V --> F1["📐 Floor Level"]
    V --> F2["📐 Floor Level"]

    F1 --> ZA1["🟦 Zone A"]
    F1 --> ZB1["🟩 Zone B"]

    F2 --> ZC2["🟨 Zone C"]
    F2 --> ZD2["🟥 Zone D"]

    ZA1 --> S1["🅿️ Slot (VIP)"]
    ZA1 --> S2["🅿️ Slot (Disabled)"]
    ZA1 --> S3["🅿️ Slot (Electric)"]
    ZA1 --> S4["🅿️ Slot (Standard)"]

    ZB1 --> S5["🅿️ Slot (Standard)"]
    ZB1 --> S6["🅿️ Slot (Standard)"]

    ZC2 --> S7["🅿️ Slot (Standard)"]
    ZD2 --> S8["🅿️ Slot (Standard)"]

    style V fill:#1a1a2e,color:#fff,stroke:#e94560
    style F1 fill:#16213e,color:#fff,stroke:#0f3460
    style F2 fill:#16213e,color:#fff,stroke:#0f3460
    style ZA1 fill:#0f3460,color:#fff
    style ZB1 fill:#0f3460,color:#fff
    style ZC2 fill:#0f3460,color:#fff
    style ZD2 fill:#0f3460,color:#fff
    style S1 fill:#e94560,color:#fff
    style S2 fill:#ffc107,color:#000
    style S3 fill:#00b894,color:#fff
    style S4 fill:#6c757d,color:#fff
    style S5 fill:#6c757d,color:#fff
    style S6 fill:#6c757d,color:#fff
    style S7 fill:#6c757d,color:#fff
    style S8 fill:#6c757d,color:#fff
```

---

## 3. Centaurus Mall — Slot Distribution (150 Slots)

### 3.1 Floor-Level Breakdown

| Floor Level | Slot Range      | Count |
|-------------|-----------------|-------|
| **B1**      | CM-001 → CM-050 | 50    |
| **B2**      | CM-051 → CM-100 | 50    |
| **Ground**  | CM-101 → CM-150 | 50    |

### 3.2 Zone Breakdown

| Zone       | Slot Range      | Count |
|------------|-----------------|-------|
| **Zone A** | CM-001 → CM-040 | 40    |
| **Zone B** | CM-041 → CM-080 | 40    |
| **Zone C** | CM-081 → CM-120 | 40    |
| **Zone D** | CM-121 → CM-150 | 30    |

### 3.3 Slot-Type Breakdown

| Slot Type    | Slot Range      | Count | Color   |
|--------------|-----------------|-------|---------|
| **VIP**      | CM-001 → CM-010 | 10    | 🔴 Red  |
| **Disabled** | CM-011 → CM-015 | 5     | 🟡 Gold |
| **Electric** | CM-016 → CM-025 | 10    | 🟢 Green|
| **Standard** | CM-026 → CM-150 | 125   | ⚪ Gray |

### 3.4 Visual Map — Centaurus Mall

```mermaid
block-beta
    columns 4

    block:header:4
        columns 4
        h1["🏢 Centaurus Mall — 150 Slots"]
    end

    block:b1:2
        columns 1
        b1h["Floor B1 (Slots 1–50)"]
        b1za["Zone A: CM-001 → CM-040"]
        b1zb["Zone B: CM-041 → CM-050"]
    end

    block:b2:2
        columns 1
        b2h["Floor B2 (Slots 51–100)"]
        b2zb["Zone B: CM-051 → CM-080"]
        b2zc["Zone C: CM-081 → CM-100"]
    end

    block:gf:4
        columns 1
        gfh["Ground Floor (Slots 101–150)"]
        gfzc["Zone C: CM-101 → CM-120"]
        gfzd["Zone D: CM-121 → CM-150"]
    end

    style header fill:#1a1a2e,color:#fff
    style b1 fill:#16213e,color:#fff
    style b2 fill:#16213e,color:#fff
    style gf fill:#0f3460,color:#fff
```

### 3.5 Slot Types on Floor B1 (Detailed)

```
Floor B1 — Slots CM-001 to CM-050
┌─────────────────────────────────────────────────────────────────────┐
│  ZONE A (CM-001 → CM-040)                                         │
│  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────────────────┐  │
│  │  VIP   │ │DISABLED│ │ ELECTRIC │ │       STANDARD           │  │
│  │001–010 │ │011–015 │ │ 016–025  │ │       026–040            │  │
│  │ 10 slots│ │ 5 slots│ │ 10 slots │ │       15 slots           │  │
│  │  🔴    │ │  🟡    │ │   🟢    │ │        ⚪               │  │
│  └────────┘ └────────┘ └──────────┘ └──────────────────────────┘  │
│                                                                     │
│  ZONE B (CM-041 → CM-050)                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     STANDARD (041–050) — 10 slots  ⚪        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Riphah University — Slot Distribution (100 Slots)

### 4.1 Floor-Level Breakdown

| Floor Level | Slot Range      | Count |
|-------------|-----------------|-------|
| **Ground**  | RU-001 → RU-100 | 100   |

> Single-floor venue — all slots are on Ground level.

### 4.2 Zone Breakdown

| Zone       | Slot Range      | Count |
|------------|-----------------|-------|
| **Zone A** | RU-001 → RU-025 | 25    |
| **Zone B** | RU-026 → RU-050 | 25    |
| **Zone C** | RU-051 → RU-075 | 25    |
| **Zone D** | RU-076 → RU-100 | 25    |

### 4.3 Slot-Type Breakdown

| Slot Type    | Slot Range      | Count |
|--------------|-----------------|-------|
| **Disabled** | RU-001 → RU-005 | 5     |
| **Electric** | RU-006 → RU-010 | 5     |
| **Standard** | RU-011 → RU-100 | 90    |

### 4.4 Visual Map — Riphah University

```
Ground Floor — 100 Slots
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Zone A (RU-001 → RU-025)                                               │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────────────────────────┐   │
│  │ DISABLED │ │ ELECTRIC │ │           STANDARD                     │   │
│  │ 001–005  │ │ 006–010  │ │           011–025                     │   │
│  │  5 slots │ │  5 slots │ │           15 slots                    │   │
│  │   🟡     │ │   🟢     │ │            ⚪                        │   │
│  └──────────┘ └──────────┘ └────────────────────────────────────────┘   │
│                                                                          │
│  Zone B (RU-026 → RU-050)         All STANDARD — 25 slots  ⚪          │
│  Zone C (RU-051 → RU-075)         All STANDARD — 25 slots  ⚪          │
│  Zone D (RU-076 → RU-100)         All STANDARD — 25 slots  ⚪          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Vehicle-Type → Slot-Type Priority Allocation

When a car checks in, ParkFlow tries to assign a slot matching the vehicle type in **priority order**. If the preferred slot type is full, it falls back to the next option.

```mermaid
flowchart LR
    subgraph Vehicle Types
        sedan["🚗 Sedan"]
        suv["🚙 SUV"]
        pickup["🛻 Pickup"]
        van["🚐 Van"]
        hatch["🚗 Hatchback"]
        car["🚘 Car (default)"]
    end

    subgraph Slot Types
        std["⚪ Standard"]
        vip["🔴 VIP"]
        elec["🟢 Electric"]
        comp["🟣 Compact"]
    end

    sedan -- "1st" --> std
    sedan -- "2nd" --> vip
    sedan -- "3rd" --> elec
    sedan -- "4th" --> comp

    suv -- "1st" --> std
    suv -- "2nd" --> vip
    suv -- "3rd" --> elec

    pickup -- "1st" --> std
    pickup -- "2nd" --> vip

    van -- "1st" --> std
    van -- "2nd" --> vip

    hatch -- "1st" --> comp
    hatch -- "2nd" --> std
    hatch -- "3rd" --> elec
    hatch -- "4th" --> vip

    car -- "1st" --> std
    car -- "2nd" --> comp
    car -- "3rd" --> vip
    car -- "4th" --> elec
```

### Priority Table

| Vehicle Type | 1st Choice   | 2nd Choice | 3rd Choice | 4th Choice |
|:------------|:-------------|:-----------|:-----------|:-----------|
| **Sedan**    | Standard     | VIP        | Electric   | Compact    |
| **SUV**      | Standard     | VIP        | Electric   | —          |
| **Pickup**   | Standard     | VIP        | —          | —          |
| **Van**      | Standard     | VIP        | —          | —          |
| **Hatchback**| Compact      | Standard   | Electric   | VIP        |
| **Car**      | Standard     | Compact    | VIP        | Electric   |

> If **all** preferred slot types are full, the system tries **any available slot** as a last resort.

---

## 6. Check-In Flow

```mermaid
flowchart TD
    A["📨 POST /api/sessions/checkin"] --> B{"Venue exists?"}
    B -- No --> B1["❌ 404 Venue not found"]
    B -- Yes --> C{"Duplicate active\nsession?"}
    C -- Yes --> C1["❌ 409 Already checked in"]
    C -- No --> D["Find or create vehicle"]
    D --> E["🔍 Slot-Type Priority Allocation"]

    E --> E1{"Try preferred\nslot type #1"}
    E1 -- Available --> F["✅ Lock slot"]
    E1 -- Full --> E2{"Try slot type #2"}
    E2 -- Available --> F
    E2 -- Full --> E3{"Try slot type #3"}
    E3 -- Available --> F
    E3 -- Full --> E4{"Any slot available?"}
    E4 -- Yes --> F
    E4 -- No --> E5["❌ 422 No slots available"]

    F --> G["👤 Auto-assign least-busy staff"]
    G --> H["💾 Create parking_session"]
    H --> I["✅ 201 Checked in!"]

    style A fill:#1a1a2e,color:#fff
    style F fill:#00b894,color:#fff
    style I fill:#00b894,color:#fff
    style B1 fill:#e94560,color:#fff
    style C1 fill:#e94560,color:#fff
    style E5 fill:#e94560,color:#fff
```

---

## 7. Slot Statuses

| Status       | Meaning                                  |
|-------------|------------------------------------------|
| `available` | Slot is free and can be assigned          |
| `occupied`  | A vehicle is currently parked in the slot |

When a vehicle **checks in**, the slot flips to `occupied`.  
When a vehicle **checks out**, the slot flips back to `available`.

---

## 8. Summary Table — All Venues

| Venue              | Total Slots | Floors          | Zones        | Slot Types                          |
|--------------------|-------------|-----------------|--------------|-------------------------------------|
| Centaurus Mall     | 150         | B1, B2, Ground  | A, B, C, D   | VIP, Disabled, Electric, Standard   |
| Islamabad Airport  | 300         | (not seeded)    | (not seeded) | (not seeded)                        |
| Riphah University  | 100         | Ground          | A, B, C, D   | Disabled, Electric, Standard        |
