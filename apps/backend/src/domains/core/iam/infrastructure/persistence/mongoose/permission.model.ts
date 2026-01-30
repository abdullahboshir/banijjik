import { Schema, model, Document } from "mongoose";

export interface IPermissionDoc extends Document {
  name: string;
  key: string;
  module: string;
  description?: string;
}

const PermissionSchema = new Schema<IPermissionDoc>(
  {
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    module: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true },
);

export const PermissionModel = model<IPermissionDoc>(
  "Permission",
  PermissionSchema,
);
