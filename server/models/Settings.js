import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    notificationTime: {
      type: String,
      default: "09:00",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Settings",
  settingsSchema
);