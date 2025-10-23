/**
 * Timezone utilities for GMT+3 (Turkey Time)
 */

const GMT_OFFSET = 3; // GMT+3

/**
 * Get current date/time in GMT+3
 */
export const getNow = () => {
  const date = new Date();
  // Add 3 hours to UTC
  date.setHours(date.getHours() + GMT_OFFSET);
  return date;
};

/**
 * Convert any date to GMT+3
 */
export const toGMT3 = (date) => {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(d.getHours() + GMT_OFFSET);
  return d;
};

/**
 * Format date for display in GMT+3
 */
export const formatDate = (date) => {
  if (!date) return null;
  const d = toGMT3(date);
  return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

/**
 * Get timestamp in GMT+3
 */
export const getTimestamp = () => {
  return getNow().getTime();
};

export default {
  getNow,
  toGMT3,
  formatDate,
  getTimestamp,
  GMT_OFFSET
};
