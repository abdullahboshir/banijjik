import { z } from 'zod';
/**
 * Student Metadata Schema
 * For academic institutions.
 */
export const StudentMetadataSchema = z.object({
    class: z.string().min(1, 'Class is required'),
    rollNumber: z.string().min(1, 'Roll number is required'),
    guardianName: z.string().min(1, 'Guardian name is required'),
    guardianPhone: z.string().optional(),
});
/**
 * Patient Metadata Schema
 * For hospitals and clinics.
 */
export const PatientMetadataSchema = z.object({
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
    age: z.number().min(0).optional(),
    lastVisit: z.string().datetime().optional(),
    history: z.array(z.string()).default([]),
});
/**
 * Employee Metadata Schema
 * For corporate and HR systems.
 */
export const EmployeeMetadataSchema = z.object({
    department: z.string().min(1, 'Department is required'),
    designation: z.string().min(1, 'Designation is required'),
    joiningDate: z.string().datetime().optional(),
    salaryGrade: z.string().optional(),
});
//# sourceMappingURL=metadata.schema.js.map