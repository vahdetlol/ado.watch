import { Snowflake } from "nodejs-snowflake";
import crypto from "crypto";

const generatedPIDs = new Set();
let sequenceCounter = 0;

export const generateProcessId = () => {
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    const timestamp = Date.now().toString().padStart(13, "0");
    const sequence = (sequenceCounter++).toString().padStart(3, "0");
    const randomHex = crypto.randomBytes(32).toString("hex");
    const pid = timestamp + sequence + randomHex;

    if (sequenceCounter > 999) sequenceCounter = 0;

    if (!generatedPIDs.has(pid)) {
      generatedPIDs.add(pid);

      if (generatedPIDs.size > 10000) {
        const firstPID = generatedPIDs.values().next().value;
        generatedPIDs.delete(firstPID);
      }

      return pid;
    }

    attempts++;
  }
  throw new Error(
    `Failed to generate unique PID after ${maxAttempts} attempts`
  );
};

// Snowflake ID generator instance
// Epoch: Jan 1, 2020 (you can adjust the epoch to your project's start date)
const instanceId = parseInt(
  process.env.INSTANCE_ID || crypto.randomInt(1, 1024)
);

if (instanceId < 1 || instanceId > 1023) {
  throw new Error("INSTANCE_ID must be between 1 and 1023");
}

const snowflake = new Snowflake({
  custom_epoch: 1577836800000, // Jan 1, 2020 00:00:00 UTC
  instance_id: instanceId, // Read from environment variable
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
