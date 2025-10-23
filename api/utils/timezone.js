
const GMT_OFFSET = 3; // GMT+3

export const getNow = () => {
  const date = new Date();
  date.setHours(date.getHours() + GMT_OFFSET);
  return date;
};

export const toGMT3 = (date) => {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(d.getHours() + GMT_OFFSET);
  return d;
};
export const formatDate = (date) => {
  if (!date) return null;
  const d = toGMT3(date);
  return d.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' });
};
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
