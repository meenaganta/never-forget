import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import webpush from "./push.js";
import connectDB from "./db.js";

import Reminder from "./models/Reminder.js";
import Subscription from "./models/Subscription.js";
import Settings from "./models/Settings.js";

dotenv.config();

await connectDB();

await import("./scheduler.js");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* =========================
   BASIC ROUTE
========================= */

app.get("/", (req, res) => {
  res.json({
    message: "Never Forget backend is running",
  });
});

/* =========================
   REMINDERS
========================= */

app.get("/api/reminders", async (req, res) => {
  try {
    const reminders = await Reminder.find()
      .sort({ createdAt: 1 })
      .lean();

    res.json(reminders);
  } catch (error) {
    console.error("Get reminders error:", error);
    res.status(500).json({
      message: "Failed to fetch reminders",
    });
  }
});

app.post("/api/reminders", async (req, res) => {
  try {
    const reminder = await Reminder.create(req.body);

    res.status(201).json(reminder);
  } catch (error) {
    console.error("Create reminder error:", error);

    res.status(500).json({
      message: "Failed to create reminder",
      error: error.message,
    });
  }
});

app.put("/api/reminders/:id", async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!reminder) {
      return res.status(404).json({
        message: "Reminder not found",
      });
    }

    res.json(reminder);
  } catch (error) {
    console.error("Update reminder error:", error);

    res.status(500).json({
      message: "Failed to update reminder",
      error: error.message,
    });
  }
});

app.patch("/api/reminders/:id/archive", async (req, res) => {
  try {
    const { archived } = req.body;

    const reminder = await Reminder.findOneAndUpdate(
      { id: req.params.id },
      { archived: Boolean(archived) },
      { new: true }
    ).lean();

    if (!reminder) {
      return res.status(404).json({
        message: "Reminder not found",
      });
    }

    res.json(reminder);
  } catch (error) {
    console.error("Archive reminder error:", error);

    res.status(500).json({
      message: "Failed to archive reminder",
    });
  }
});

app.patch("/api/reminders/:id", async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!reminder) {
      return res.status(404).json({
        message: "Reminder not found",
      });
    }

    res.json(reminder);
  } catch (error) {
    console.error("Patch reminder error:", error);

    res.status(500).json({
      message: "Failed to update reminder",
      error: error.message,
    });
  }
});

app.delete("/api/reminders/:id", async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      id: req.params.id,
    });

    if (!reminder) {
      return res.status(404).json({
        message: "Reminder not found",
      });
    }

    res.json({
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    console.error("Delete reminder error:", error);

    res.status(500).json({
      message: "Failed to delete reminder",
      error: error.message,
    });
  }
});

/* =========================
   SETTINGS
========================= */

app.get("/api/settings", async (req, res) => {
  try {
    let settings = await Settings.findOne().lean();

    if (!settings) {
      settings = await Settings.create({
        notificationTime: "09:00",
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);

    res.status(500).json({
      message: "Failed to fetch settings",
    });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }

    await settings.save();

    res.json(settings);
  } catch (error) {
    console.error("Update settings error:", error);

    res.status(500).json({
      message: "Failed to update settings",
      error: error.message,
    });
  }
});

/* =========================
   PUSH PUBLIC KEY
========================= */

app.get("/api/push/public-key", (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY,
  });
});

/* =========================
   PUSH SUBSCRIBE
========================= */

app.post("/api/push/subscribe", async (req, res) => {
  try {
    const subscription = req.body;

    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.keys
    ) {
      return res.status(400).json({
        message: "Invalid push subscription",
      });
    }

    const savedSubscription =
      await Subscription.findOneAndUpdate(
        {
          endpoint: subscription.endpoint,
        },
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    res.status(201).json(savedSubscription);
  } catch (error) {
    console.error("Subscribe error:", error);

    res.status(500).json({
      message: "Failed to save push subscription",
      error: error.message,
    });
  }
});

/* =========================
   PUSH UNSUBSCRIBE
========================= */

app.post("/api/push/unsubscribe", async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;

    if (!endpoint) {
      return res.status(400).json({
        message: "Endpoint is required",
      });
    }

    await Subscription.deleteOne({
      endpoint,
    });

    res.json({
      message: "Push subscription removed",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);

    res.status(500).json({
      message: "Failed to remove subscription",
    });
  }
});

/* =========================
   TEST PUSH
========================= */

app.post("/api/push/test", async (req, res) => {
  try {
    const subscriptions =
      await Subscription.find().lean();

    if (subscriptions.length === 0) {
      return res.status(404).json({
        message: "No push subscriptions available",
      });
    }

    const payload = JSON.stringify({
      title: "🔔 Never Forget",
      body: "Test notification received successfully!",
      url: "/",
    });

    let sent = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          subscription,
          payload
        );

        sent++;
      } catch (error) {
        console.error(
          "Test push error:",
          error.statusCode,
          error.message
        );

        if (
          error.statusCode === 404 ||
          error.statusCode === 410
        ) {
          await Subscription.deleteOne({
            endpoint: subscription.endpoint,
          });
        }
      }
    }

    res.json({
      message: "Test notification sent",
      sent,
    });
  } catch (error) {
    console.error("Test push error:", error);

    res.status(500).json({
      message: "Failed to send test notification",
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `Never Forget backend running on port ${PORT}`
  );
});