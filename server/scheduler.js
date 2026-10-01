import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import webpush from "./push.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDirectory = path.join(
  __dirname,
  "data"
);

const remindersFile = path.join(
  dataDirectory,
  "reminders.json"
);

const subscriptionsFile = path.join(
  dataDirectory,
  "subscriptions.json"
);

const sentFile = path.join(
  dataDirectory,
  "sent.json"
);

const settingsFile = path.join(
  dataDirectory,
  "settings.json"
);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]");
  }

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

function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      process.env.TIMEZONE || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCurrentTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone:
      process.env.TIMEZONE || "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function daysBetween(date1, date2) {
  const first = new Date(
    `${date1}T00:00:00`
  );

  const second = new Date(
    `${date2}T00:00:00`
  );

  return Math.floor(
    (second - first) /
      (1000 * 60 * 60 * 24)
  );
}

function shouldSend(reminder) {
  const today = getToday();

  if (today > reminder.date) {
    return false;
  }

  const daysLeft = daysBetween(
    today,
    reminder.date
  );

  if (reminder.frequency === "On the day") {
    return daysLeft === 0;
  }

  if (reminder.frequency === "Daily") {
    return daysLeft >= 0;
  }

  const createdDate =
    reminder.createdAt.split("T")[0];

  const elapsedDays = daysBetween(
    createdDate,
    today
  );

  if (reminder.frequency === "Every 2 days") {
    return (
      elapsedDays >= 0 &&
      elapsedDays % 2 === 0
    );
  }

  if (reminder.frequency === "Weekly") {
    return (
      elapsedDays >= 0 &&
      elapsedDays % 7 === 0
    );
  }

  return false;
}

async function sendReminderNotification(
  reminder
) {
  const subscriptions =
    readJson(subscriptionsFile);

  if (subscriptions.length === 0) {
    console.log(
      "No push subscriptions available."
    );

    return;
  }

  const today = getToday();

  const payload = JSON.stringify({
    title: `🔔 ${reminder.title}`,
    body:
      reminder.date === today
        ? "Your important date is today!"
        : `${daysBetween(
            today,
            reminder.date
          )} days left`,
    url: "/",
    reminderId: reminder.id,
  });

  const validSubscriptions = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        subscription,
        payload
      );

      validSubscriptions.push(subscription);

      console.log(
        `Notification sent: ${reminder.title}`
      );
    } catch (error) {
      console.error(
        "Push error:",
        error.statusCode,
        error.message
      );

      if (
        error.statusCode !== 404 &&
        error.statusCode !== 410
      ) {
        validSubscriptions.push(
          subscription
        );
      }
    }
  }

  writeJson(
    subscriptionsFile,
    validSubscriptions
  );
}

async function checkReminders() {
  const currentTime = getCurrentTime();

const settings = readJson(settingsFile);

const notificationTime =
  settings.notificationTime || "09:00";

const targetTime = notificationTime;

console.log(
  `Scheduler check → Current: ${currentTime} | Target: ${targetTime}`
);

if (currentTime !== targetTime) {
  return;
}

  const reminders =
    readJson(remindersFile);

  const sent =
    readJson(sentFile);

  const today = getToday();

  for (const reminder of reminders) {
    if (!shouldSend(reminder)) {
      continue;
    }

    const sentKey =
      `${reminder.id}_${today}`;

    if (sent.includes(sentKey)) {
      continue;
    }

    await sendReminderNotification(
      reminder
    );

    sent.push(sentKey);
  }

  writeJson(sentFile, sent);
}

/*
Runs every minute.
The actual notification time is controlled
by NOTIFICATION_HOUR and NOTIFICATION_MINUTE.
*/
cron.schedule(
  "* * * * *",
  () => {
    checkReminders().catch((error) => {
      console.error(
        "Scheduler error:",
        error
      );
    });
  },
  {
    timezone:
      process.env.TIMEZONE || "Asia/Kolkata",
  }
);

console.log(
  "Reminder scheduler started."
);