import B2 from "backblaze-b2";
import fs from "fs";
import path from "path";
import dns from "dns";
import { promisify } from "util";
import { sendProgress } from "./progressNotifier.js";
import { createLogger } from "./logger.js";

const logger = createLogger("BACKBLAZE");
const dnsLookup = promisify(dns.lookup);

let b2Client = null;
let authData = null;
let authTimestamp = null;
const AUTH_EXPIRY_MS = 22 * 60 * 60 * 1000;

const verifyDnsResolution = async (hostname, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await dnsLookup(hostname);
      logger.debug(`DNS resolved ${hostname} to ${result.address}`);
      return true;
    } catch (error) {
      logger.warn(
        `DNS lookup failed for ${hostname} (Attempt ${attempt}/${maxRetries}):`,
        error.message
      );

      if (attempt < maxRetries) {
        const waitTime = 1000 * attempt;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }
  return false;
};

const initializeB2 = async (maxRetries = 3) => {
  if (b2Client && authData && authTimestamp) {
    const authAge = Date.now() - authTimestamp;
    if (authAge < AUTH_EXPIRY_MS) {
      logger.debug(
        `Reusing valid B2 auth (${Math.round(authAge / 1000 / 60)} min old)`
      );
      return { b2: b2Client, auth: authData };
    } else {
      logger.info("B2 auth expired, re-authorizing...");
      b2Client = null;
      authData = null;
      authTimestamp = null;
    }
  }

  const applicationKeyId = process.env.B2_APPLICATION_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!applicationKeyId || !applicationKey) {
    throw new Error(
      "Backblaze B2 credentials not found in environment variables"
    );
  }

  b2Client = new B2({
    applicationKeyId,
    applicationKey,
    retry: {
      retries: 3,
    },
  });

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Authorizing B2 (Attempt ${attempt}/${maxRetries})`);
      authData = await b2Client.authorize();
      authTimestamp = Date.now();
      logger.info("Backblaze B2 authorized successfully");
      return { b2: b2Client, auth: authData };
    } catch (error) {
      lastError = error;
      logger.error(
        `B2 authorization failed (Attempt ${attempt}/${maxRetries}):`,
        error.message
      );

      if (attempt < maxRetries) {
        const waitTime = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        logger.debug(`Retrying authorization in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Reset client for fresh attempt
        b2Client = new B2({
          applicationKeyId,
          applicationKey,
          retry: {
            retries: 3,
          },
        });
      }
    }
  }

  b2Client = null;
  authData = null;
  authTimestamp = null;
  throw new Error(
    `B2 authorization failed after ${maxRetries} attempts: ${lastError.message}`
  );
};

const uploadToB2 = async (
  localFilePath,
  b2FileName,
  bucketId = null,
  maxRetries = 3
) => {
  const targetBucketId = bucketId || process.env.B2_BUCKET_ID;
  if (!targetBucketId) {
    throw new Error("B2_BUCKET_ID not found in environment variables");
  }

  const fileName = b2FileName || path.basename(localFilePath);
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(
        `Uploading to B2: ${fileName} (Attempt ${attempt}/${maxRetries})`
      );

      const { b2, auth } = await initializeB2();

      const uploadUrlResponse = await b2.getUploadUrl({
        bucketId: targetBucketId,
      });

      const uploadUrl = new URL(uploadUrlResponse.data.uploadUrl);
      const canResolve = await verifyDnsResolution(uploadUrl.hostname);

      if (!canResolve) {
        throw new Error(`DNS resolution failed for ${uploadUrl.hostname}`);
      }

      const fileData = fs.readFileSync(localFilePath);

      const uploadResponse = await Promise.race([
        b2.uploadFile({
          uploadUrl: uploadUrlResponse.data.uploadUrl,
          uploadAuthToken: uploadUrlResponse.data.authorizationToken,
          fileName: fileName,
          data: fileData,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Upload timeout after 10 minutes")),
            600000 // 10 dakika - büyük dosyalar için
          )
        ),
      ]);

      logger.info(`Upload successful: ${fileName}`);

      const bucketName = process.env.B2_BUCKET_NAME;
      const fileUrl = bucketName
        ? `https://${bucketName}.s3.eu-central-003.backblazeb2.com/${fileName}`
        : null;

      return {
        success: true,
        fileId: uploadResponse.data.fileId,
        fileName: uploadResponse.data.fileName,
        fileUrl: fileUrl,
        size: uploadResponse.data.contentLength,
      };
    } catch (error) {
      lastError = error;

      const isRetryableError =
        error.code === "ENOTFOUND" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNRESET" ||
        error.code === "ECONNREFUSED" ||
        error.message?.includes("timeout") ||
        error.message?.includes("network");

      logger.error(
        `B2 upload error (Attempt ${attempt}/${maxRetries}):`,
        error.message
      );

      if (attempt < maxRetries && isRetryableError) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.debug(`Retrying in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        b2Client = null;
        authData = null;
        continue;
      }

      break;
    }
  }

  logger.error(`B2 upload failed after ${maxRetries} attempts`);
  throw new Error(`B2 upload failed: ${lastError.message}`);
};

const deleteFromB2 = async (fileId, fileName) => {
  try {
    const { b2 } = await initializeB2();

    logger.info(`Deleting from B2: ${fileName}`);

    await b2.deleteFileVersion({
      fileId: fileId,
      fileName: fileName,
    });

    logger.info(`Delete successful: ${fileName}`);

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    logger.error("B2 delete error:", error);
    throw new Error(`B2 delete failed: ${error.message}`);
  }
};

const uploadVideoToB2 = async (videoPath, thumbnailPath = null) => {
  try {
    const results = {
      video: null,
      thumbnail: null,
    };

    if (videoPath && fs.existsSync(videoPath)) {
      const videoFileName = `videos/${path.basename(videoPath)}`;
      results.video = await uploadToB2(videoPath, videoFileName);

      fs.unlinkSync(videoPath);
      logger.info(`Local video deleted: ${videoPath}`);
    }

    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      const thumbFileName = `thumbnails/${path.basename(thumbnailPath)}`;
      results.thumbnail = await uploadToB2(thumbnailPath, thumbFileName);

      fs.unlinkSync(thumbnailPath);
      logger.info(`Local thumbnail deleted: ${thumbnailPath}`);
    }

    return results;
  } catch (error) {
    logger.error("Video upload to B2 failed:", error);
    throw error;
  }
};

const uploadAllResolutionsToB2 = async (
  videoData,
  thumbnailPath = null,
  pid = null
) => {
  const results = {
    resolutions: [],
    thumbnail: null,
    errors: [],
  };

  const resolutionProgress = {};
  const baseProgress = 55;
  const uploadSpace = 35;
  const uploadSpacePerResolution = uploadSpace / videoData.length;

  for (let i = 0; i < videoData.length; i++) {
    const video = videoData[i];
    if (video.filename && fs.existsSync(video.filename)) {
      try {
        const currentOverallProgress =
          baseProgress + i * uploadSpacePerResolution;

        resolutionProgress[video.resolution] = 0;

        if (pid) {
          await sendProgress(
            pid,
            Math.round(currentOverallProgress),
            `uploading_${video.resolution}`,
            {
              resolutions: resolutionProgress,
              currentResolution: video.resolution,
              totalResolutions: videoData.length,
              completedResolutions: i,
            }
          );
        }

        const videoFileName = `videos/${path.basename(video.filename)}`;
        const uploadResult = await uploadToB2(video.filename, videoFileName);

        results.resolutions.push({
          resolution: video.resolution,
          height: video.height,
          width: video.width,
          fileUrl: uploadResult.fileUrl,
          fileId: uploadResult.fileId,
          size: uploadResult.size,
        });

        resolutionProgress[video.resolution] = 100;

        if (pid) {
          await sendProgress(
            pid,
            Math.round(currentOverallProgress + uploadSpacePerResolution),
            `uploaded_${video.resolution}`,
            {
              resolutions: resolutionProgress,
              currentResolution: video.resolution,
              totalResolutions: videoData.length,
              completedResolutions: i + 1,
            }
          );
        }

        fs.unlinkSync(video.filename);
        logger.info(
          `Local video deleted: ${video.filename} (${video.resolution})`
        );
      } catch (error) {
        logger.error(`Failed to upload ${video.resolution}:`, error.message);
        resolutionProgress[video.resolution] = -1;
        results.errors.push({
          resolution: video.resolution,
          filename: video.filename,
          error: error.message,
        });
      }
    }
  }

  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    try {
      const thumbFileName = `thumbnails/${path.basename(thumbnailPath)}`;
      results.thumbnail = await uploadToB2(thumbnailPath, thumbFileName);
      fs.unlinkSync(thumbnailPath);
      logger.info(`Local thumbnail deleted: ${thumbnailPath}`);
    } catch (error) {
      logger.error(`Failed to upload thumbnail:`, error.message);
      results.errors.push({
        type: "thumbnail",
        filename: thumbnailPath,
        error: error.message,
      });
    }
  }

  if (results.resolutions.length === 0 && results.errors.length > 0) {
    logger.error("All resolutions upload to B2 failed");
    throw new Error(
      `All uploads failed. First error: ${results.errors[0].error}`
    );
  }

  if (results.errors.length > 0) {
    logger.warn(
      `${results.errors.length} upload(s) failed, but ${results.resolutions.length} succeeded`
    );
  }

  return results;
};
const getFileInfo = async (fileId) => {
  try {
    const { b2 } = await initializeB2();

    const response = await b2.getFileInfo({
      fileId: fileId,
    });

    return response.data;
  } catch (error) {
    logger.error("B2 get file info error:", error);
    throw new Error(`B2 get file info failed: ${error.message}`);
  }
};

export {
  initializeB2,
  uploadToB2,
  deleteFromB2,
  uploadVideoToB2,
  uploadAllResolutionsToB2,
  getFileInfo,
};
