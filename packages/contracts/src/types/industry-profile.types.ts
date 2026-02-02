import {
  INDUSTRY_BLUEPRINTS,
  IFieldDefinition,
  OrganizationIndustryType,
} from "@banijjik/contracts";

// ════════════════════════════════════════════════════════════════
// Auto-generated TypeScript types for each industry's profile
// ════════════════════════════════════════════════════════════════

/**
 * Helper type to convert field type to TypeScript type
 */
type FieldTypeToTS<T extends IFieldDefinition["type"]> = T extends "string"
  ? string
  : T extends "number"
    ? number
    : T extends "date"
      ? Date
      : T extends "boolean"
        ? boolean
        : T extends "enum"
          ? string
          : unknown;

// ═══════════════════════════════════════════════════════════════
// COACHING Industry Profile (Student)
// ═══════════════════════════════════════════════════════════════
export interface CoachingProfileAttributes {
  roll_no: string;
  academic_session: string;
  class:
    | "Class 1"
    | "Class 2"
    | "Class 3"
    | "Class 4"
    | "Class 5"
    | "Class 6"
    | "Class 7"
    | "Class 8"
    | "Class 9"
    | "Class 10"
    | "SSC"
    | "HSC"
    | "Admission";
  group?: "Science" | "Commerce" | "Arts" | "General";
  shift?: "Morning" | "Day" | "Evening";
  guardianId?: string; // Reference to another Person (Guardian)
}

// ═══════════════════════════════════════════════════════════════
// GYM Industry Profile (Member)
// ═══════════════════════════════════════════════════════════════
export interface GymProfileAttributes {
  membership_id: string;
  membership_plan:
    | "Monthly"
    | "Quarterly"
    | "Half-Yearly"
    | "Yearly"
    | "Life-time";
  weight_kg?: number;
  height_cm?: number;
  target_goal?: "Weight Loss" | "Muscle Gain" | "Body Building" | "Fitness";
  trainerId?: string; // Reference to Staff Person
}

// ═══════════════════════════════════════════════════════════════
// CLINIC Industry Profile (Patient)
// ═══════════════════════════════════════════════════════════════
export interface ClinicProfileAttributes {
  patient_id: string;
  allergies?: string;
  emergency_contact: string;
  history?: string;
  bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
}

// ═══════════════════════════════════════════════════════════════
// HOSTEL Industry Profile
// ═══════════════════════════════════════════════════════════════
export interface HostelProfileAttributes {
  room_no: string;
  seat_no: string;
  guardian_name: string;
  meal_preference: "Veg" | "Non-Veg" | "Diet";
}

// ═══════════════════════════════════════════════════════════════
// SALON Industry Profile
// ═══════════════════════════════════════════════════════════════
export interface SalonProfileAttributes {
  hair_type?: "Straight" | "Curly" | "Oily" | "Dry";
  skin_type?: "Normal" | "Oily" | "Dry" | "Sensitive";
  last_visit_service?: string;
  preference?: string;
}

// ═══════════════════════════════════════════════════════════════
// RETAIL Industry Profile
// ═══════════════════════════════════════════════════════════════
export interface RetailProfileAttributes {
  customer_tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  loyalty_points?: number;
  staff_id?: string;
}

// ═══════════════════════════════════════════════════════════════
// RESTAURANT Industry Profile
// ═══════════════════════════════════════════════════════════════
export interface RestaurantProfileAttributes {
  staff_position?: "Manager" | "Chef" | "Waiter" | "Cashier" | "Delivery";
  shift?: "Morning" | "Afternoon" | "Night";
  joining_date: Date;
}

// ═══════════════════════════════════════════════════════════════
// PARLOR Industry Profile
// ═══════════════════════════════════════════════════════════════
export interface ParlorProfileAttributes {
  service_frequency?: "Weekly" | "Monthly" | "Occasional";
  special_interest?: string;
  birthday?: Date;
}

// ═══════════════════════════════════════════════════════════════
// Union type for all industry profiles
// ═══════════════════════════════════════════════════════════════
export type IndustryProfileAttributes =
  | CoachingProfileAttributes
  | GymProfileAttributes
  | ClinicProfileAttributes
  | HostelProfileAttributes
  | SalonProfileAttributes
  | RetailProfileAttributes
  | RestaurantProfileAttributes
  | ParlorProfileAttributes
  | Record<string, any>; // Fallback for industries without specific type

// ═══════════════════════════════════════════════════════════════
// Industry to Profile Type Map
// ═══════════════════════════════════════════════════════════════
export interface IndustryProfileMap {
  COACHING: CoachingProfileAttributes;
  GYM: GymProfileAttributes;
  CLINIC: ClinicProfileAttributes;
  HOSTEL: HostelProfileAttributes;
  SALON: SalonProfileAttributes;
  RETAIL: RetailProfileAttributes;
  RESTAURANT: RestaurantProfileAttributes;
  PARLOR: ParlorProfileAttributes;
  IT: Record<string, any>;
  OTHER: Record<string, any>;
}

/**
 * Helper type to get profile type for a specific industry
 */
export type ProfileAttributesFor<T extends OrganizationIndustryType> =
  T extends keyof IndustryProfileMap
    ? IndustryProfileMap[T]
    : Record<string, any>;
