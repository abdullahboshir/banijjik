import { Schema, model } from "mongoose";
const PersonSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    gender: { type: String },
    dateOfBirth: { type: Date },
    profilePicture: { type: String },
    bloodGroup: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    emergencyContact: { type: String },
    nid: { type: String },
    permanentAddress: { type: String },
    currentAddress: { type: String },
    status: { type: String, default: "active" },
    // Key-Value Store for Dynamic Profile Data
    profileAttributes: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
export const PersonModel = model("Person", PersonSchema);
//# sourceMappingURL=person.model.js.map