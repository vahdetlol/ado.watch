import { Snowflake } from 'nodejs-snowflake';

// Snowflake ID generator instance
// Epoch: 1 Ocak 2020 (epoch değerini proje başlangıç tarihine göre ayarlayabilirsiniz)
const instanceId = parseInt(process.env.INSTANCE_ID || '1', 10);

if (instanceId < 1 || instanceId > 1023) {
  throw new Error('INSTANCE_ID must be between 1 and 1023');
}

const snowflake = new Snowflake({
  custom_epoch: 1577836800000, // 1 Ocak 2020 00:00:00 UTC
  instance_id: instanceId // Environment variable'dan okunuyor
});

/**
 * Yeni bir Snowflake ID oluşturur
 * @returns {string} Snowflake ID
 */
export const generateId = () => {
  return snowflake.getUniqueID().toString();
};

/**
 * Snowflake ID'den zaman damgasını çıkarır
 * @param {string} id - Snowflake ID
 * @returns {Date} Oluşturma zamanı
 */
export const getTimestampFromId = (id) => {
  const timestamp = snowflake.timestampFromID(id);
  return new Date(timestamp);
};

export default snowflake;
