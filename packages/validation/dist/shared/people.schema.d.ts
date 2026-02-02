import { z } from "zod";
/**
 * Universal Person Profile Schema
 */
export declare const PersonProfileSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
    }>>;
    dateOfBirth: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDate>>;
    bloodGroup: z.ZodOptional<z.ZodEnum<{
        "A+": "A+";
        "A-": "A-";
        "B+": "B+";
        "B-": "B-";
        "O+": "O+";
        "O-": "O-";
        "AB+": "AB+";
        "AB-": "AB-";
    }>>;
    fatherName: z.ZodOptional<z.ZodString>;
    motherName: z.ZodOptional<z.ZodString>;
    emergencyContact: z.ZodOptional<z.ZodString>;
    nid: z.ZodOptional<z.ZodString>;
    permanentAddress: z.ZodOptional<z.ZodString>;
    currentAddress: z.ZodOptional<z.ZodString>;
    profilePicture: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const JoinOrganizationSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    userId: z.ZodString;
    organizationId: z.ZodString;
    type: z.ZodLiteral<any>;
    metadata: z.ZodObject<{
        class: z.ZodString;
        rollNumber: z.ZodString;
        guardianName: z.ZodString;
        guardianPhone: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    userId: z.ZodString;
    organizationId: z.ZodString;
    type: z.ZodLiteral<any>;
    metadata: z.ZodObject<{
        bloodGroup: z.ZodOptional<z.ZodEnum<{
            "A+": "A+";
            "A-": "A-";
            "B+": "B+";
            "B-": "B-";
            "O+": "O+";
            "O-": "O-";
            "AB+": "AB+";
            "AB-": "AB-";
        }>>;
        age: z.ZodOptional<z.ZodNumber>;
        lastVisit: z.ZodOptional<z.ZodString>;
        history: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    userId: z.ZodString;
    organizationId: z.ZodString;
    type: z.ZodLiteral<any>;
    metadata: z.ZodObject<{
        department: z.ZodString;
        designation: z.ZodString;
        joiningDate: z.ZodOptional<z.ZodString>;
        salaryGrade: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    userId: z.ZodString;
    organizationId: z.ZodString;
    type: z.ZodEnum<{
        [x: string]: any;
    }>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>], "type">;
//# sourceMappingURL=people.schema.d.ts.map