import cron from "node-cron";
import dotenv from "dotenv";

import webpush from "./push.js";
import Reminder from "./models/Reminder.js";
import Subscription from "./models/Subscription.js";
import Settings from "./models/Settings.js";
import NotificationLog from "./models/NotificationLog.js";

dotenv.config();

/* =========================
   DATE / TIME HELPERS
========================= */

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

/* =========================
   REMINDER LOGIC
========================= */

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

/* =========================
   SEND NOTIFICATION
========================= */

async function sendReminderNotification(
  reminder
) {
  const subscriptions =
    await Subscription.find().lean();

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

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        subscription,
        payload
      );

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
        error.statusCode === 404 ||
        error.statusCode === 410
      ) {
        await Subscription.deleteOne({
          endpoint: subscription.endpoint,
        });

        console.log(
          "Removed expired push subscription."
        );
      }
    }
  }
}

/* =========================
   CHECK REMINDERS
========================= */

async function checkReminders() {
  try {
    const currentTime = getCurrentTime();

    const settings =
      await Settings.findOne().lean();

    const notificationTime =
      settings?.notificationTime || "09:00";

    console.log(
      `Scheduler check → Current: ${currentTime} | Target: ${notificationTime}`
    );

    if (currentTime !== notificationTime) {
      return;
    }

    const reminders =
      await Reminder.find().lean();

    const today = getToday();

    for (const reminder of reminders) {
      if (!shouldSend(reminder)) {
        continue;
      }

      const sentKey =
        `${reminder.id}_${today}`;

      const alreadySent =
        await NotificationLog.exists({
          sentKey,
        });

      if (alreadySent) {
        continue;
      }

      await sendReminderNotification(
        reminder
      );

      await NotificationLog.create({
        sentKey,
        reminderId: reminder.id,
        date: today,
      });
    }
  } catch (error) {
    console.error(
      "Scheduler error:",
      error
    );
  }
}

/* =========================
   RUN EVERY MINUTE
========================= */

cron.schedule(
  "* * * * *",
  () => {
    checkReminders();
  },
  {
    timezone:
      process.env.TIMEZONE || "Asia/Kolkata",
  }
);

console.log(
  "Reminder scheduler started."
);