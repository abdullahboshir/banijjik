import { z } from 'zod';
/**
 * Student Metadata Schema
 * For academic institutions.
 */
export declare const StudentMetadataSchema: z.ZodObject<{
    class: z.ZodString;
    rollNumber: z.ZodString;
    guardianName: z.ZodString;
    guardianPhone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Patient Metadata Schema
 * For hospitals and clinics.
 */
export declare const PatientMetadataSchema: z.ZodObject<{
    bloodGroup: z.ZodOptional<z.ZodEnum<{
        "A+": "A+";
        "A-": "A-";
        "B+": "B+";
        "B-": "B-";
        "AB+": "AB+";
        "AB-": "AB-";
        "O+": "O+";
        "O-": "O-";
    }>>;
    age: z.ZodOptional<z.ZodNumber>;
    lastVisit: z.ZodOptional<z.ZodString>;
    history: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Employee Metadata Schema
 * For corporate and HR systems.
 */
export declare const EmployeeMetadataSchema: z.ZodObject<{
    department: z.ZodString;
    designation: z.ZodString;
    joiningDate: z.ZodOptional<z.ZodString>;
    salaryGrade: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=metadata.schema.d.ts.map