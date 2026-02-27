export function generateTimeSlots(startHour, endHour) {
  const slots = [];

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const start = new Date(0, 0, 0, hour, min);
      const end = new Date(0, 0, 0, hour, min + 30);

      slots.push(
        `${start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })} – ${end.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}`
      );
    }
  }

  return slots;
}

/**
 * Generate individual time point options (e.g. "7:00 AM", "7:30 AM", ..., "10:00 PM")
 * for use in time selection dropdowns. Format matches generateTimeSlots() output.
 */
export function generateTimeOptions(startHour = 7, endHour = 22) {
  const options = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      if (hour === endHour && min > 0) break;
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayMin = min.toString().padStart(2, "0");
      options.push(`${displayHour}:${displayMin} ${period}`);
    }
  }
  return options;
}

/**
 * Convert a time string like "7:00 AM" or "1:30 PM" to minutes from midnight.
 * Returns -1 if the format is invalid.
 */
export function timeToMinutes(timeStr) {
  const match = timeStr?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let [, h, m, period] = match;
  h = parseInt(h);
  m = parseInt(m);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Validate that a time string matches the expected "H:MM AM/PM" format.
 */
export function isValidTimeFormat(timeStr) {
  return /^(1[0-2]|[1-9]):([0-5]\d)\s(AM|PM)$/.test(timeStr);
}
