import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("NotificationLog", notificationLogSchema);