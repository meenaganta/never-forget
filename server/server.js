import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import webpush from "./push.js";
import "./scheduler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;



app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDirectory = path.join(
  __dirname,
  "data"
);

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, {
    recursive: true,
  });
}

const settingsFile = path.join(
  dataDirectory,
  "settings.json"
);

const remindersFile = path.join(
  dataDirectory,
  "reminders.json"
);

const subscriptionsFile = path.join(
  dataDirectory,
  "subscriptions.json"
);

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]");
  }
}

function readJson(filePath) {
  ensureFile(filePath);

  try {
    return JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    );
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2)
  );
}

ensureFile(remindersFile);
ensureFile(subscriptionsFile);
ensureFile(settingsFile);

/* =========================
   BASIC ROUTE
========================= */

app.get("/", (req, res) => {
  res.json({
    message: "Never Forget backend is running",
  });
});

/* =========================
   GET REMINDERS
========================= */

app.get("/api/reminders", (req, res) => {
  const reminders = readJson(remindersFile);

  res.json(reminders);
});

/* =========================
   ADD REMINDER
========================= */

app.post("/api/reminders", (req, res) => {
  const {
    title,
    date,
    category,
    frequency,
  } = req.body;

  if (
    !title ||
    !date ||
    !category ||
    !frequency
  ) {
    return res.status(400).json({
      message:
        "All reminder fields are required.",
    });
  }

  const reminders =
    readJson(remindersFile);

  const reminder = {
    id: Date.now().toString(),
    title: title.trim(),
    date,
    category,
    frequency,
    createdAt:
      new Date().toISOString(),
  };

  reminders.push(reminder);

  writeJson(
    remindersFile,
    reminders
  );

  res.status(201).json(reminder);
});

/* =========================
   EDIT REMINDER
========================= */

app.put(
  "/api/reminders/:id",
  (req, res) => {
    const {
      title,
      date,
      category,
      frequency,
    } = req.body;

    if (
      !title ||
      !date ||
      !category ||
      !frequency
    ) {
      return res.status(400).json({
        message:
          "All reminder fields are required.",
      });
    }

    const reminders =
      readJson(remindersFile);

    const reminderIndex =
      reminders.findIndex(
        (reminder) =>
          reminder.id ===
          req.params.id
      );

    if (reminderIndex === -1) {
      return res.status(404).json({
        message:
          "Reminder not found.",
      });
    }

    const existingReminder =
      reminders[reminderIndex];

    const updatedReminder = {
      ...existingReminder,
      title: title.trim(),
      date,
      category,
      frequency,
      updatedAt:
        new Date().toISOString(),
    };

    reminders[reminderIndex] =
      updatedReminder;

    writeJson(
      remindersFile,
      reminders
    );

    res.json(updatedReminder);
  }
);

app.patch("/api/reminders/:id/archive", (req, res) => {
  const { archived } = req.body;

  if (typeof archived !== "boolean") {
    return res.status(400).json({
      message: "Archived value must be true or false.",
    });
  }

  const reminders = readJson(remindersFile);

  const reminderIndex = reminders.findIndex(
    (reminder) => reminder.id === req.params.id
  );

  if (reminderIndex === -1) {
    return res.status(404).json({
      message: "Reminder not found.",
    });
  }

  reminders[reminderIndex] = {
    ...reminders[reminderIndex],
    archived,
    updatedAt: new Date().toISOString(),
  };

  writeJson(remindersFile, reminders);

  res.json(reminders[reminderIndex]);
});

/* =========================
   DELETE REMINDER
========================= */

app.delete(
  "/api/reminders/:id",
  (req, res) => {
    const reminders =
      readJson(remindersFile);

    const updatedReminders =
      reminders.filter(
        (reminder) =>
          reminder.id !==
          req.params.id
      );

    writeJson(
      remindersFile,
      updatedReminders
    );

    res.json({
      message:
        "Reminder deleted successfully.",
    });
  }
);

/* =========================
   PUSH PUBLIC KEY
========================= */

app.get("/api/settings", (req, res) => {
  const settings = readJson(settingsFile);

  res.json({
    notificationTime:
      settings.notificationTime || "09:00",
  });
});

app.put("/api/settings", (req, res) => {
  const { notificationTime } = req.body;

  if (!notificationTime) {
    return res.status(400).json({
      message: "Notification time is required.",
    });
  }

  const settings = {
    notificationTime,
  };

  writeJson(settingsFile, settings);

  res.json(settings);
});

app.get(
  "/api/push/public-key",
  (req, res) => {
    res.json({
      publicKey:
        process.env.VAPID_PUBLIC_KEY,
    });
  }
);

/* =========================
   SAVE PUSH SUBSCRIPTION
========================= */

app.post(
  "/api/push/subscribe",
  (req, res) => {
    const subscription = req.body;

    if (
      !subscription ||
      !subscription.endpoint
    ) {
      return res.status(400).json({
        message:
          "Invalid push subscription.",
      });
    }

    const subscriptions =
      readJson(
        subscriptionsFile
      );

    const alreadyExists =
      subscriptions.some(
        (item) =>
          item.endpoint ===
          subscription.endpoint
      );

    if (!alreadyExists) {
      subscriptions.push(
        subscription
      );

      writeJson(
        subscriptionsFile,
        subscriptions
      );
    }

    res.json({
      message:
        "Push subscription saved.",
    });
  }
);

/* =========================
   REMOVE PUSH SUBSCRIPTION
========================= */

app.post(
  "/api/push/unsubscribe",
  (req, res) => {
    const { endpoint } =
      req.body;

    if (!endpoint) {
      return res.status(400).json({
        message:
          "Endpoint is required.",
      });
    }

    const subscriptions =
      readJson(
        subscriptionsFile
      );

    const updatedSubscriptions =
      subscriptions.filter(
        (item) =>
          item.endpoint !==
          endpoint
      );

    writeJson(
      subscriptionsFile,
      updatedSubscriptions
    );

    res.json({
      message:
        "Subscription removed.",
    });
  }
);

/* =========================
   TEST NOTIFICATION
========================= */

app.post(
  "/api/push/test",
  async (req, res) => {
    const subscriptions =
      readJson(
        subscriptionsFile
      );

    if (
      subscriptions.length === 0
    ) {
      return res.status(400).json({
        message:
          "No push subscription found. Enable notifications first.",
      });
    }

    const reminders =
      readJson(remindersFile);

    if (reminders.length === 0) {
      return res.status(400).json({
        message:
          "No reminders found.",
      });
    }

    const reminder =
      reminders[0];

    const payload =
      JSON.stringify({
        title: `🔔 ${reminder.title}`,
        body:
          "Test notification — click to open this reminder.",
        url: "/",
        reminderId:
          reminder.id,
      });

    const results = [];

    for (
      const subscription of subscriptions
    ) {
      try {
        await webpush.sendNotification(
          subscription,
          payload
        );

        results.push({
          success: true,
          endpoint:
            subscription.endpoint,
        });
      } catch (error) {
        console.error(
          "Push notification failed:",
          error.message
        );

        results.push({
          success: false,
          endpoint:
            subscription.endpoint,
          error:
            error.message,
        });
      }
    }

    res.json({
      message:
        "Test notification processed.",
      results,
    });
  }
);

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `Never Forget backend running on http://localhost:${PORT}`
  );
});