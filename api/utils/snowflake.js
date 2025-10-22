import { Snowflake } from 'nodejs-snowflake';

// Snowflake ID generator instance
// Epoch: Jan 1, 2020 (you can adjust the epoch to your project's start date)
const instanceId = parseInt(process.env.INSTANCE_ID || '1', 10);

if (instanceId < 1 || instanceId > 1023) {
  throw new Error('INSTANCE_ID must be between 1 and 1023');
}

const snowflake = new Snowflake({
  custom_epoch: 1577836800000, // Jan 1, 2020 00:00:00 UTC
  instance_id: instanceId // Read from environment variable
});

/**
 * Generates a new Snowflake ID
 * @returns {string} Snowflake ID
 */
export const generateId = () => {
  return snowflake.getUniqueID().toString();
};

/**
 * Extracts the timestamp from a Snowflake ID
 * @param {string} id - Snowflake ID
 * @returns {Date} Creation time
 */
export const getTimestampFromId = (id) => {
  const timestamp = snowflake.timestampFromID(id);
  return new Date(timestamp);
};

export default snowflake;
