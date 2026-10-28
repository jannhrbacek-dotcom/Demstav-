export function durationMinutes(text) {
  if (!/^\d{1,2}:[0-5]\d$/.test(text || "")) return null;
  const [h, m] = text.split(":").map(Number);
  return h * 60 + m <= 1440 ? h * 60 + m : null;
}
export function journeyText(record) {
  const minutes = record.driveMinutes ?? durationMinutes(record.drive);
  return minutes != null ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}` : record.drive ? "neověřeno" : "";
}
