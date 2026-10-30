export const ENROLLMENT_CREATION_MODE = {
  STAFF: "STAFF",
  CUSTOMER_REQUEST: "CUSTOMER_REQUEST",
} as const;

export type EnrollmentCreationMode =
  (typeof ENROLLMENT_CREATION_MODE)[keyof typeof ENROLLMENT_CREATION_MODE];
