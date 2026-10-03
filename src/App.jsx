import { useEffect, useState } from "react";
import "./App.css";

const API_URL ="https://never-forget-backend.onrender.com";

const categories = [
  { name: "Birthday", icon: "🎂" },
  { name: "Ticket", icon: "🎫" },
  { name: "Exam", icon: "📚" },
  { name: "Deadline", icon: "⏰" },
  { name: "Other", icon: "📝" },
];

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}

function App() {
  const [showModal, setShowModal] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [date, setDate] =
    useState("");

  const [category, setCategory] =
    useState("Other");

  const [frequency, setFrequency] =
    useState("Daily");

  const [reminders, setReminders] =
    useState([]);

  const [
    notificationsEnabled,
    setNotificationsEnabled,
  ] = useState(false);

  const [
    showNotificationSettings,
    setShowNotificationSettings,
  ] = useState(false);

  const [notificationTime, setNotificationTime] =
    useState("09:00");

  const [
    savingNotificationSettings,
    setSavingNotificationSettings,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    highlightedReminderId,
    setHighlightedReminderId,
  ] = useState(null);

  const [
    editingReminderId,
    setEditingReminderId,
  ] = useState(null);

  const [isEditing, setIsEditing] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("All");

  const [activeTab, setActiveTab] =
    useState("upcoming");

  const [importingBackup, setImportingBackup] =
  useState(false);

  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    loadReminders();
    checkNotificationStatus();
    loadNotificationSettings();

    const params =
      new URLSearchParams(
        window.location.search
      );

    const reminderId =
      params.get("reminder");

    if (reminderId) {
      setHighlightedReminderId(
        reminderId
      );
    }
  }, []);

  /* =========================
     LOAD NOTIFICATION SETTINGS
  ========================= */

  const loadNotificationSettings =
    async () => {
      try {
        const response =
          await fetch(
            `${API_URL}/api/settings`
          );

        if (!response.ok) {
          throw new Error(
            "Failed to load notification settings"
          );
        }

        const data =
          await response.json();

        setNotificationTime(
          data.notificationTime ||
            "09:00"
        );
      } catch (error) {
        console.error(
          "Failed to load notification settings:",
          error
        );
      }
    };

  /* =========================
     SCROLL TO HIGHLIGHTED REMINDER
  ========================= */

  useEffect(() => {
    if (!highlightedReminderId) {
      return;
    }

    const reminder =
      reminders.find(
        (item) =>
          item.id ===
          highlightedReminderId
      );

    if (reminder) {
      if (reminder.archived === true) {
        setActiveTab("archived");
      } else {
        const daysLeft =
          getDaysLeft(reminder.date);

        if (daysLeft < 0) {
          setActiveTab("past");
        } else {
          setActiveTab("upcoming");
        }
      }
    }

    const timer = setTimeout(() => {
      const element =
        document.getElementById(
          `reminder-${highlightedReminderId}`
        );

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [
    highlightedReminderId,
    reminders,
  ]);

  /* =========================
     LOAD REMINDERS
  ========================= */

  const loadReminders =
    async () => {
      try {
        const response =
          await fetch(
            `${API_URL}/api/reminders`
          );

        if (!response.ok) {
          throw new Error(
            "Failed to load reminders"
          );
        }

        const data =
          await response.json();

        setReminders(data);
      } catch (error) {
        console.error(
          "Failed to load reminders:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     CHECK NOTIFICATION STATUS
  ========================= */

  const checkNotificationStatus =
    async () => {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator)
      ) {
        setNotificationsEnabled(false);
        return;
      }

      if (
        Notification.permission !==
        "granted"
      ) {
        setNotificationsEnabled(false);
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        setNotificationsEnabled(
          Boolean(subscription)
        );
      } catch (error) {
        console.error(
          "Failed to check notification subscription:",
          error
        );

        setNotificationsEnabled(false);
      }
    };

  /* =========================
     ENABLE NOTIFICATIONS
  ========================= */

  const enableNotifications =
    async () => {
      try {
        if (!("Notification" in window)) {
          alert(
            "Your browser does not support notifications."
          );
          return;
        }

        if (
          !("serviceWorker" in navigator)
        ) {
          alert(
            "Service Worker is not supported."
          );
          return;
        }

        const permission =
          await Notification.requestPermission();

        if (permission !== "granted") {
          alert(
            "Please allow notifications for Never Forget."
          );
          return;
        }

        const registration =
          await navigator.serviceWorker.ready;

        const response =
          await fetch(
            `${API_URL}/api/push/public-key`
          );

        if (!response.ok) {
          throw new Error(
            "Could not get VAPID public key from backend."
          );
        }

        const data =
          await response.json();

        let subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription =
            await registration.pushManager.subscribe(
              {
                userVisibleOnly: true,
                applicationServerKey:
                  urlBase64ToUint8Array(
                    data.publicKey
                  ),
              }
            );
        }

        const saveResponse =
          await fetch(
            `${API_URL}/api/push/subscribe`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                subscription
              ),
            }
          );

        if (!saveResponse.ok) {
          throw new Error(
            "Could not save push subscription to backend."
          );
        }

        setNotificationsEnabled(true);

        alert(
          "Notifications enabled successfully! 🔔"
        );
      } catch (error) {
        console.error(
          "Notification setup error:",
          error
        );

        alert(
          `Could not enable notifications.\n\n${error.message}`
        );
      }
    };

  /* =========================
     DISABLE NOTIFICATIONS
  ========================= */

  const disableNotifications =
    async () => {
      try {
        if (
          !("serviceWorker" in navigator)
        ) {
          alert(
            "Service Worker is not supported."
          );
          return;
        }

        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          setNotificationsEnabled(false);

          alert(
            "Notifications are already disabled."
          );

          return;
        }

        const endpoint =
          subscription.endpoint;

        const unsubscribed =
          await subscription.unsubscribe();

        if (!unsubscribed) {
          throw new Error(
            "Could not unsubscribe from browser notifications."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/push/unsubscribe`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                endpoint,
              }),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Could not disable notifications on the backend."
          );
        }

        setNotificationsEnabled(false);

        alert(
          "Notifications disabled successfully. 🔕"
        );
      } catch (error) {
        console.error(
          "Notification disable error:",
          error
        );

        alert(
          `Could not disable notifications.\n\n${error.message}`
        );
      }
    };

  /* =========================
     DAYS LEFT
  ========================= */

  const getDaysLeft = (
    targetDate
  ) => {
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const target = new Date(
      targetDate + "T00:00:00"
    );

    target.setHours(
      0,
      0,
      0,
      0
    );

    const difference =
      target - today;

    return Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );
  };

  /* =========================
     FORMAT TIME
  ========================= */

  const formatTime = (time) => {
    const [hour, minute] =
      time.split(":").map(Number);

    const dateObject = new Date();

    dateObject.setHours(
      hour,
      minute,
      0,
      0
    );

    return dateObject.toLocaleTimeString(
      "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    );
  };

  /* =========================
     ADD REMINDER
  ========================= */

  const addReminder = async (e) => {
    e.preventDefault();

    if (
      !title.trim() ||
      !date
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/api/reminders`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              date,
              category,
              frequency,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Failed to save reminder"
        );
      }

      const newReminder =
        await response.json();

      setReminders((prev) => [
        ...prev,
        newReminder,
      ]);

      closeModal();
    } catch (error) {
      console.error(
        "Failed to add reminder:",
        error
      );

      alert(
        "Could not save reminder. Is the backend running?"
      );
    }
  };

  /* =========================
     OPEN EDIT MODAL
  ========================= */

  const openEditModal = (
    reminder
  ) => {
    setEditingReminderId(
      reminder.id
    );

    setTitle(
      reminder.title
    );

    setDate(
      reminder.date
    );

    setCategory(
      reminder.category
    );

    setFrequency(
      reminder.frequency
    );

    setIsEditing(true);
    setShowModal(true);
  };

  /* =========================
     UPDATE REMINDER
  ========================= */

  const updateReminder =
    async (e) => {
      e.preventDefault();

      if (
        !editingReminderId ||
        !title.trim() ||
        !date
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/reminders/${editingReminderId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                title:
                  title.trim(),
                date,
                category,
                frequency,
              }),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to update reminder"
          );
        }

        const updatedReminder =
          await response.json();

        setReminders((prev) =>
          prev.map(
            (reminder) =>
              reminder.id ===
              updatedReminder.id
                ? updatedReminder
                : reminder
          )
        );

        closeModal();
      } catch (error) {
        console.error(
          "Failed to update reminder:",
          error
        );

        alert(
          "Could not update reminder. Is the backend running?"
        );
      }
    };

  /* =========================
     CLOSE MODAL
  ========================= */

  const closeModal = () => {
    setShowModal(false);

    setTitle("");
    setDate("");
    setCategory("Other");
    setFrequency("Daily");

    setEditingReminderId(null);
    setIsEditing(false);
  };

  /* =========================
     DELETE REMINDER
  ========================= */

  const deleteReminder =
    async (id) => {
      try {
        const response =
          await fetch(
            `${API_URL}/api/reminders/${id}`,
            {
              method: "DELETE",
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to delete reminder"
          );
        }

        setReminders((prev) =>
          prev.filter(
            (reminder) =>
              reminder.id !== id
          )
        );

        if (
          highlightedReminderId ===
          id
        ) {
          setHighlightedReminderId(
            null
          );
        }
      } catch (error) {
        console.error(
          "Failed to delete reminder:",
          error
        );
      }
    };

  /* =========================
     ARCHIVE / RESTORE REMINDER
  ========================= */

  const toggleArchiveReminder =
    async (
      reminderId,
      archived
    ) => {
      try {
        const response =
          await fetch(
            `${API_URL}/api/reminders/${reminderId}/archive`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                archived,
              }),
            }
          );

        if (!response.ok) {
          const data =
            await response.json();

          throw new Error(
            data.message ||
              "Failed to update reminder."
          );
        }

        const updatedReminder =
          await response.json();

        setReminders((prev) =>
          prev.map((reminder) =>
            reminder.id ===
            updatedReminder.id
              ? updatedReminder
              : reminder
          )
        );
      } catch (error) {
        console.error(
          "Archive reminder error:",
          error
        );

        alert(
          `Could not update reminder.\n\n${error.message}`
        );
      }
    };

  /* =========================
     CATEGORY ICON
  ========================= */

  const getCategoryIcon =
    (categoryName) => {
      const category =
        categories.find(
          (item) =>
            item.name ===
            categoryName
        );

      return category
        ? category.icon
        : "📝";
    };

  /* =========================
     FORMAT DATE
  ========================= */

  const formatDate =
    (dateString) => {
      const dateObject =
        new Date(
          dateString +
            "T00:00:00"
        );

      return dateObject.toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      );
    };

  /* =========================
     SORT REMINDERS
  ========================= */

  const sortedReminders =
    [...reminders].sort(
      (a, b) =>
        new Date(a.date) -
        new Date(b.date)
    );

  /* =========================
     UPCOMING / PAST
  ========================= */

  const upcomingReminders =
    sortedReminders.filter(
      (reminder) =>
        reminder.archived !== true &&
        getDaysLeft(
          reminder.date
        ) >= 0
    );

  const pastReminders =
    sortedReminders
      .filter(
        (reminder) =>
          reminder.archived !== true &&
          getDaysLeft(
            reminder.date
          ) < 0
      )
      .reverse();

  /* =========================
     ARCHIVED
  ========================= */

  const archivedReminders =
    sortedReminders.filter(
      (reminder) =>
        reminder.archived === true
    );

  /* =========================
     ACTIVE TAB REMINDERS
  ========================= */

  const activeReminders =
    activeTab === "upcoming"
      ? upcomingReminders
      : activeTab === "past"
      ? pastReminders
      : archivedReminders;

  /* =========================
     SEARCH + CATEGORY FILTER
  ========================= */

  const filteredReminders =
    activeReminders.filter(
      (reminder) => {
        const matchesSearch =
          reminder.title
            .toLowerCase()
            .includes(
              searchQuery
                .toLowerCase()
                .trim()
            );

        const matchesCategory =
          categoryFilter ===
            "All" ||
          reminder.category ===
            categoryFilter;

        return (
          matchesSearch &&
          matchesCategory
        );
      }
    );

  /* =========================
     SAVE NOTIFICATION SETTINGS
  ========================= */

  const saveNotificationSettings =
    async () => {
      try {
        setSavingNotificationSettings(
          true
        );

        const response =
          await fetch(
            `${API_URL}/api/settings`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                notificationTime,
              }),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to save notification settings"
          );
        }

        alert(
          `Notification time saved: ${formatTime(
            notificationTime
          )} 🔔`
        );

        setShowNotificationSettings(
          false
        );
      } catch (error) {
        console.error(
          "Failed to save notification settings:",
          error
        );

        alert(
          "Could not save notification settings. Is the backend running?"
        );
      } finally {
        setSavingNotificationSettings(
          false
        );
      }
    };

    /* =========================
   EXPORT BACKUP
========================= */

const exportBackup = () => {
  try {
    if (reminders.length === 0) {
      alert(
        "There are no reminders to export."
      );
      return;
    }

    const backupData = {
      app: "Never Forget",
      version: 1,
      exportedAt:
        new Date().toISOString(),
      reminders,
    };

    const jsonData =
      JSON.stringify(
        backupData,
        null,
        2
      );

    const blob = new Blob(
      [jsonData],
      {
        type: "application/json",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `never-forget-backup-${new Date()
      .toISOString()
      .split("T")[0]}.json`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    alert(
      "Backup exported successfully! 📥"
    );
  } catch (error) {
    console.error(
      "Export backup error:",
      error
    );

    alert(
      "Could not export backup."
    );
  }
};

/* =========================
   IMPORT BACKUP
========================= */

const importBackup = async (
  event
) => {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    setImportingBackup(true);

    if (
      file.type !==
        "application/json" &&
      !file.name.endsWith(".json")
    ) {
      throw new Error(
        "Please select a JSON backup file."
      );
    }

    const text =
      await file.text();

    const backupData =
      JSON.parse(text);

    if (
      !backupData ||
      !Array.isArray(
        backupData.reminders
      )
    ) {
      throw new Error(
        "Invalid Never Forget backup file."
      );
    }

    const existingIds =
      new Set(
        reminders.map(
          (reminder) =>
            reminder.id
        )
      );

    const newReminders =
      backupData.reminders
        .filter(
          (reminder) =>
            reminder &&
            reminder.title &&
            reminder.date &&
            reminder.category &&
            reminder.frequency
        )
        .filter(
          (reminder) =>
            !existingIds.has(
              reminder.id
            )
        )
        .map((reminder) => ({
          ...reminder,
          id:
            reminder.id &&
            !existingIds.has(
              reminder.id
            )
              ? reminder.id
              : `${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`,
        }));

    if (
      newReminders.length === 0
    ) {
      alert(
        "No new reminders found in this backup."
      );
      return;
    }

    const savedReminders = [];

    for (const reminder of newReminders) {
      const response =
        await fetch(
          `${API_URL}/api/reminders`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title:
                reminder.title,
              date:
                reminder.date,
              category:
                reminder.category,
              frequency:
                reminder.frequency,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          `Failed to import reminder: ${reminder.title}`
        );
      }

      const savedReminder =
        await response.json();

      if (
        reminder.archived === true
      ) {
        const archiveResponse =
          await fetch(
            `${API_URL}/api/reminders/${savedReminder.id}/archive`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                archived: true,
              }),
            }
          );

        if (
          archiveResponse.ok
        ) {
          const archivedReminder =
            await archiveResponse.json();

          savedReminders.push(
            archivedReminder
          );

          continue;
        }
      }

      savedReminders.push(
        savedReminder
      );
    }

    setReminders((prev) => [
      ...prev,
      ...savedReminders,
    ]);

    alert(
      `${savedReminders.length} reminder${
        savedReminders.length === 1
          ? ""
          : "s"
      } imported successfully! 📤`
    );
  } catch (error) {
    console.error(
      "Import backup error:",
      error
    );

    alert(
      `Could not import backup.\n\n${error.message}`
    );
  } finally {
    setImportingBackup(false);

    event.target.value = "";
  }
};

  /* =========================
     CLEAR FILTERS
  ========================= */

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("All");
  };

  /* =========================
     RETURN
  ========================= */

  return (
    <div className="app">

      {/* =========================
          HEADER
      ========================= */}

      <header className="header">

        <div className="brand">

          <div className="logo">
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
    />
    <path d="M10 21h4" />
  </svg>
</div>

          <div>
            <h1>
              Never Forget
            </h1>

            <p>
              Important dates,
              remembered for you.
            </p>
          </div>

        </div>

        <div className="header-actions">

          <button
            className="notification-button"
            onClick={() =>
              setShowNotificationSettings(
                true
              )
            }
          >
            <span className="notification-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>
</span>

<span>
  {notificationsEnabled
    ? "Notifications On"
    : "Notifications"}
</span>
          </button>

          <button
            className="add-button"
            onClick={() => {
              closeModal();
              setShowModal(true);
            }}
          >
            <span>+</span>
            <span className="button-text">
    Add Reminder
  </span>
          </button>

        </div>

      </header>

      {/* =========================
          MAIN
      ========================= */}

      <main className="main">

        {/* HERO */}

        <section className="hero">

          <div>

            <span className="eyebrow">
              YOUR REMINDERS
            </span>

            <h2>
              Stay ahead of
              important dates.
            </h2>

            <p>
              Create reminders and
              get notified as your
              important date gets
              closer.
            </p>

          </div>

          <div className="total-box">

            <strong>
              {reminders.length}
            </strong>

            <span>
              Total reminders
            </span>

          </div>

        </section>

        {/* =========================
            REMINDERS SECTION
        ========================= */}

        <section className="reminders-section">

          <div className="section-header">

            <h2>
              My Reminders
            </h2>

            {reminders.length > 0 && (
              <span>
                {reminders.length}{" "}
                {reminders.length === 1
                  ? "reminder"
                  : "reminders"}
              </span>
            )}

          </div>

          {/* =========================
    BACKUP ACTIONS
========================= */}

{reminders.length > 0 && (
  <div className="backup-actions">

    <button
      className="export-backup-button"
      onClick={exportBackup}
    >
      📥 Export Backup
    </button>

    <label
      className="import-backup-button"
    >
      📤{" "}
      {importingBackup
        ? "Importing..."
        : "Import Backup"}

      <input
        type="file"
        accept=".json,application/json"
        onChange={importBackup}
        disabled={importingBackup}
        hidden
      />
    </label>

  </div>
)}

          {/* UPCOMING / PAST / ARCHIVED */}

          {reminders.length > 0 && (
            <div className="reminder-tabs">

              <button
                className={
                  activeTab ===
                  "upcoming"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "upcoming"
                  )
                }
              >
                📅 Upcoming

                <span>
                  {
                    upcomingReminders.length
                  }
                </span>

              </button>

              <button
                className={
                  activeTab === "past"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab("past")
                }
              >
                🕘 Past

                <span>
                  {
                    pastReminders.length
                  }
                </span>

              </button>

              <button
                className={
                  activeTab ===
                  "archived"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "archived"
                  )
                }
              >
                📦 Archived

                <span>
                  {
                    archivedReminders.length
                  }
                </span>

              </button>

            </div>
          )}

          {/* SEARCH & FILTER */}

          {activeReminders.length > 0 && (
            <div className="search-filter">

              <div className="search-box">

                <span>
                  🔎
                </span>

                <input
                  type="text"
                  placeholder={
                    activeTab ===
                    "upcoming"
                      ? "Search upcoming reminders..."
                      : activeTab ===
                        "past"
                      ? "Search past reminders..."
                      : "Search archived reminders..."
                  }
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(
                      e.target.value
                    )
                  }
                />

                {searchQuery && (
                  <button
                    className="clear-search"
                    onClick={() =>
                      setSearchQuery("")
                    }
                    title="Clear search"
                  >
                    ×
                  </button>
                )}

              </div>

              <select
                className="category-filter"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All Categories
                </option>

                {categories.map(
                  (item) => (
                    <option
                      key={item.name}
                      value={item.name}
                    >
                      {item.icon}{" "}
                      {item.name}
                    </option>
                  )
                )}

              </select>

              {(searchQuery ||
                categoryFilter !==
                  "All") && (
                <button
                  className="clear-filters"
                  onClick={
                    clearFilters
                  }
                >
                  Clear Filters
                </button>
              )}

            </div>
          )}

          {/* LOADING */}

          {loading ? (

            <div className="empty-state">

              <div className="empty-icon">
                ⏳
              </div>

              <h3>
                Loading reminders...
              </h3>

            </div>

          ) : reminders.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                📅
              </div>

              <h3>
                No reminders yet
              </h3>

              <p>
                Add your first
                important date and
                never forget it again.
              </p>

              <button
                onClick={() => {
                  closeModal();
                  setShowModal(true);
                }}
              >
                Create Reminder
              </button>

              <label
  className="import-backup-empty-button"
>
  📤 Import Backup

  <input
    type="file"
    accept=".json,application/json"
    onChange={importBackup}
    disabled={importingBackup}
    hidden
  />
</label>

            </div>

          ) : activeReminders.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                {activeTab ===
                "upcoming"
                  ? "🎉"
                  : activeTab === "past"
                  ? "📭"
                  : "📦"}
              </div>

              <h3>
                {activeTab ===
                "upcoming"
                  ? "No upcoming reminders"
                  : activeTab === "past"
                  ? "No past reminders"
                  : "No archived reminders"}
              </h3>

              <p>
                {activeTab ===
                "upcoming"
                  ? "You are all caught up! Add a new important date."
                  : activeTab === "past"
                  ? "Your past reminders will appear here."
                  : "Your archived reminders will appear here."}
              </p>

              {activeTab ===
                "upcoming" && (
                <button
                  onClick={() => {
                    closeModal();
                    setShowModal(true);
                  }}
                >
                  Add Reminder
                </button>
              )}

            </div>

          ) : filteredReminders.length === 0 ? (

            <div className="empty-state no-results">

              <div className="empty-icon">
                🔍
              </div>

              <h3>
                No reminders found
              </h3>

              <p>
                Try a different
                search or category.
              </p>

              <button
                onClick={
                  clearFilters
                }
              >
                Clear Filters
              </button>

            </div>

          ) : (

            <div className="reminder-grid">

              {filteredReminders.map(
                (reminder) => {

                  const daysLeft =
                    getDaysLeft(
                      reminder.date
                    );

                  const isPast =
                    daysLeft < 0;

                  return (

                    <div
                      key={reminder.id}
                      id={`reminder-${reminder.id}`}
                      className={`reminder-card ${
                        highlightedReminderId ===
                        reminder.id
                          ? "highlighted"
                          : ""
                      } ${
                        isPast
                          ? "past-reminder"
                          : ""
                      } ${
                        reminder.archived
                          ? "archived-reminder"
                          : ""
                      }`}
                    >

                      {/* CARD TOP */}

                      <div className="card-top">

                        <div className="category-icon">
                          {getCategoryIcon(
                            reminder.category
                          )}
                        </div>

                        <div className="card-actions">

                          <button
                            className="edit-button"
                            onClick={() =>
                              openEditModal(
                                reminder
                              )
                            }
                            title="Edit reminder"
                          >
                            ✏️
                          </button>

                          <button
                            className="delete-button"
                            onClick={() =>
                              deleteReminder(
                                reminder.id
                              )
                            }
                            title="Delete reminder"
                          >
                            🗑️
                          </button>

                          {activeTab ===
                          "archived" ? (

                            <button
                              className="restore-button"
                              onClick={() =>
                                toggleArchiveReminder(
                                  reminder.id,
                                  false
                                )
                              }
                              title="Restore reminder"
                            >
                              ↩️
                            </button>

                          ) : (

                            <button
                              className="archive-button"
                              onClick={() =>
                                toggleArchiveReminder(
                                  reminder.id,
                                  true
                                )
                              }
                              title="Archive reminder"
                            >
                              📦
                            </button>

                          )}

                        </div>

                      </div>

                      {/* CARD CONTENT */}

                      <div className="card-content">

                        <span className="category">
                          {
                            reminder.category
                          }
                        </span>

                        <h3>
                          {
                            reminder.title
                          }
                        </h3>

                        <p className="date">
                          📅{" "}
                          {formatDate(
                            reminder.date
                          )}
                        </p>

                      </div>

                      {/* DAYS BOX */}

                      <div className="days-box">

                        <div>

                          <strong>
                            {isPast
                              ? "Past"
                              : daysLeft === 0
                              ? "Today"
                              : daysLeft}
                          </strong>

                          {!isPast &&
                            daysLeft > 0 && (
                              <span>
                                {daysLeft === 1
                                  ? "day left"
                                  : "days left"}
                              </span>
                            )}

                        </div>

                        <div className="frequency">
                          🔔{" "}
                          {
                            reminder.frequency
                          }
                        </div>

                      </div>

                    </div>

                  );
                }
              )}

            </div>

          )}

        </section>

      </main>

      {/* =========================
          ADD / EDIT MODAL
      ========================= */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={closeModal}
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>
                  {isEditing
                    ? "Edit Reminder"
                    : "Add Reminder"}
                </h2>

                <p>
                  {isEditing
                    ? "Update your important date."
                    : "What should we help you remember?"}
                </p>

              </div>

              <button
                className="close-button"
                onClick={closeModal}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                isEditing
                  ? updateReminder
                  : addReminder
              }
            >

              <label>
                Reminder name
              </label>

              <input
                type="text"
                placeholder="e.g. TTD Darshan Tickets"
                value={title}
                onChange={(e) =>
                  setTitle(
                    e.target.value
                  )
                }
                autoFocus
              />

              <label>
                Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(
                    e.target.value
                  )
                }
                min={
                  new Date()
                    .toISOString()
                    .split("T")[0]
                }
              />

              <label>
                Category
              </label>

              <div className="category-grid">

                {categories.map(
                  (item) => (

                    <button
                      type="button"
                      key={item.name}
                      className={`category-option ${
                        category ===
                        item.name
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setCategory(
                          item.name
                        )
                      }
                    >

                      <span>
                        {
                          item.icon
                        }
                      </span>

                      {item.name}

                    </button>

                  )
                )}

              </div>

              <label>
                Reminder frequency
              </label>

              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(
                    e.target.value
                  )
                }
              >

                <option>
                  Daily
                </option>

                <option>
                  Every 2 days
                </option>

                <option>
                  Weekly
                </option>

                <option>
                  On the day
                </option>

              </select>

              <button
                type="submit"
                className="save-button"
              >
                {isEditing
                  ? "Update Reminder"
                  : "Save Reminder"}
              </button>

            </form>

          </div>

        </div>

      )}

      {/* =========================
          NOTIFICATION SETTINGS
      ========================= */}

      {showNotificationSettings && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowNotificationSettings(
              false
            )
          }
        >

          <div
            className="modal notification-settings-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>
                  Notification Settings
                </h2>

                <p>
                  Manage how Never Forget
                  reminds you.
                </p>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowNotificationSettings(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="notification-settings-content">

              {/* STATUS */}

              <div className="notification-status-card">

                <div>

                  <strong>
                    Notifications
                  </strong>

                  <p>
                    {notificationsEnabled
                      ? "You will receive reminder notifications."
                      : "Notifications are currently disabled."}
                  </p>

                </div>

                <span
                  className={
                    notificationsEnabled
                      ? "status-on"
                      : "status-off"
                  }
                >
                  {notificationsEnabled
                    ? "ON"
                    : "OFF"}
                </span>

              </div>

              {/* NOTIFICATION TIME */}

              <div className="notification-time-section">

                <label>
                  Notification Time
                </label>

                <input
                  type="time"
                  value={
                    notificationTime
                  }
                  onChange={(e) =>
                    setNotificationTime(
                      e.target.value
                    )
                  }
                />

                <p>
                  Reminders will be
                  checked every day at{" "}
                  {formatTime(
                    notificationTime
                  )}
                  .
                </p>

              </div>

              {/* ENABLE NOTIFICATIONS */}

              {!notificationsEnabled && (

                <button
                  className="save-button"
                  onClick={async () => {
                    await enableNotifications();

                    if (
                      Notification.permission ===
                      "granted"
                    ) {
                      const registration =
                        await navigator.serviceWorker.ready;

                      const subscription =
                        await registration.pushManager.getSubscription();

                      setNotificationsEnabled(
                        Boolean(subscription)
                      );
                    }
                  }}
                >
                  🔔 Enable Notifications
                </button>

              )}

              {/* TEST NOTIFICATION */}

              {notificationsEnabled && (

                <button
                  className="test-notification-button"
                  onClick={async () => {
                    try {

                      const response =
                        await fetch(
                          `${API_URL}/api/push/test`,
                          {
                            method:
                              "POST",
                          }
                        );

                      const data =
                        await response.json();

                      if (!response.ok) {
                        throw new Error(
                          data.message ||
                            "Test notification failed."
                        );
                      }

                      alert(
                        "Test notification sent! 🔔"
                      );

                    } catch (error) {

                      console.error(
                        "Test notification error:",
                        error
                      );

                      alert(
                        error.message
                      );

                    }
                  }}
                >
                  🧪 Send Test Notification
                </button>

              )}

              {/* DISABLE NOTIFICATIONS */}

              {notificationsEnabled && (

                <button
                  className="disable-notification-button"
                  onClick={
                    disableNotifications
                  }
                >
                  🔕 Disable Notifications
                </button>

              )}

              {/* SAVE SETTINGS */}

              <button
                className="save-button"
                onClick={
                  saveNotificationSettings
                }
                disabled={
                  savingNotificationSettings
                }
              >
                {savingNotificationSettings
                  ? "Saving..."
                  : "Save Settings"}
              </button>

              {/* INFO */}

              <div className="notification-info">

                <span>
                  💡
                </span>

                <p>
                  Your reminders will be
                  checked automatically
                  according to your
                  reminder frequency.
                </p>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;