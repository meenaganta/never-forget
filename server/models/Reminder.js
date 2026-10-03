import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    title: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      default: "Other",
    },

    frequency: {
      type: String,
      default: "On the day",
    },

    archived: {
      type: Boolean,
      default: false,
    },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export default mongoose.model("Reminder", reminderSchema);