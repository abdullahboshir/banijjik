import { ORGANIZATION_INDUSTRY } from "./organization";

export interface IFieldDefinition {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum" | "boolean";
  required: boolean;
  options?: string[]; // for enum type
  placeholder?: string;
  description?: string;
}

export type IndustryBlueprint = Record<string, IFieldDefinition[]>;

export const INDUSTRY_BLUEPRINTS: IndustryBlueprint = {
  [ORGANIZATION_INDUSTRY.COACHING]: [
    {
      key: "roll_no",
      label: "Roll Number",
      type: "string",
      required: true,
      placeholder: "e.g. 10120",
    },
    {
      key: "academic_session",
      label: "Session",
      type: "string",
      required: true,
      placeholder: "2023-24",
    },
    {
      key: "class",
      label: "Class",
      type: "enum",
      required: true,
      options: [
        "Class 1",
        "Class 2",
        "Class 3",
        "Class 4",
        "Class 5",
        "Class 6",
        "Class 7",
        "Class 8",
        "Class 9",
        "Class 10",
        "SSC",
        "HSC",
        "Admission",
      ],
    },
    {
      key: "group",
      label: "Group",
      type: "enum",
      required: false,
      options: ["Science", "Commerce", "Arts", "General"],
    },
    {
      key: "shift",
      label: "Shift",
      type: "enum",
      required: false,
      options: ["Morning", "Day", "Evening"],
    },
  ],
  [ORGANIZATION_INDUSTRY.GYM]: [
    {
      key: "membership_id",
      label: "Member ID",
      type: "string",
      required: true,
      placeholder: "GYM-xxxx",
    },
    {
      key: "membership_plan",
      label: "Active Plan",
      type: "enum",
      required: true,
      options: ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "Life-time"],
    },
    { key: "weight_kg", label: "Weight (kg)", type: "number", required: false },
    { key: "height_cm", label: "Height (cm)", type: "number", required: false },
    {
      key: "target_goal",
      label: "Target Goal",
      type: "enum",
      required: false,
      options: ["Weight Loss", "Muscle Gain", "Body Building", "Fitness"],
    },
  ],
  [ORGANIZATION_INDUSTRY.HOSTEL]: [
    { key: "room_no", label: "Room Number", type: "string", required: true },
    { key: "seat_no", label: "Seat Number", type: "string", required: true },
    {
      key: "guardian_name",
      label: "Guardian Name",
      type: "string",
      required: true,
    },
    {
      key: "meal_preference",
      label: "Meal Preference",
      type: "enum",
      required: true,
      options: ["Veg", "Non-Veg", "Diet"],
    },
  ],
  [ORGANIZATION_INDUSTRY.CLINIC]: [
    { key: "patient_id", label: "Patient ID", type: "string", required: true },
    {
      key: "allergies",
      label: "Allergies",
      type: "string",
      required: false,
      placeholder: "e.g. Penicillin, Dust",
    },
    {
      key: "emergency_contact",
      label: "Emergency Contact",
      type: "string",
      required: true,
    },
    {
      key: "history",
      label: "Medical History",
      type: "string",
      required: false,
    },
  ],
  [ORGANIZATION_INDUSTRY.SALON]: [
    {
      key: "hair_type",
      label: "Hair Type",
      type: "enum",
      required: false,
      options: ["Straight", "Curly", "Oily", "Dry"],
    },
    {
      key: "skin_type",
      label: "Skin Type",
      type: "enum",
      required: false,
      options: ["Normal", "Oily", "Dry", "Sensitive"],
    },
    {
      key: "last_visit_service",
      label: "Last Service",
      type: "string",
      required: false,
    },
    {
      key: "preference",
      label: "Customer Notes",
      type: "string",
      required: false,
    },
  ],
  [ORGANIZATION_INDUSTRY.RETAIL]: [
    {
      key: "customer_tier",
      label: "Customer Tier",
      type: "enum",
      required: true,
      options: ["Bronze", "Silver", "Gold", "Platinum"],
    },
    {
      key: "loyalty_points",
      label: "Loyalty Points",
      type: "number",
      required: false,
    },
    {
      key: "staff_id",
      label: "Employee ID",
      type: "string",
      required: false,
      description: "Only for staff members",
    },
  ],
  [ORGANIZATION_INDUSTRY.RESTAURANT]: [
    {
      key: "staff_position",
      label: "Staff Position",
      type: "enum",
      required: false,
      options: ["Manager", "Chef", "Waiter", "Cashier", "Delivery"],
    },
    {
      key: "shift",
      label: "Work Shift",
      type: "enum",
      required: false,
      options: ["Morning", "Afternoon", "Night"],
    },
    {
      key: "joining_date",
      label: "Joining Date",
      type: "date",
      required: true,
    },
  ],
  [ORGANIZATION_INDUSTRY.PARLOR]: [
    {
      key: "service_frequency",
      label: "Frequency",
      type: "enum",
      required: false,
      options: ["Weekly", "Monthly", "Occasional"],
    },
    {
      key: "special_interest",
      label: "Interest",
      type: "string",
      required: false,
      placeholder: "e.g. Facial, Bridal",
    },
    {
      key: "birthday",
      label: "Birthday (For Offers)",
      type: "date",
      required: false,
    },
  ],
};
