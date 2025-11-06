import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";
import path from "path";
import fs from "fs";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export const extractThumbnail = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ["00:00:01"],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: "1920x1080",
      })
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err));
  });
};

export const getDuration = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

export const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      try {
        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video"
        );
        resolve({
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          codec: videoStream?.codec_name || null,
          duration: metadata.format.duration || 0,
        });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};
/**
 * Creates a 720p version of the input video, targeting a maximum size of 256MB.
 * If the original video is 720p or lower, the function skips processing.
 *
 * @param {string} inputPath - The path to the input video file.
 * @param {string} outputPath - The path where the 720p video will be saved.
 * @returns {Promise<{success: boolean, outputPath: string, size: number, actualSizeMB: number}>}
 * Resolves with an object containing success status, output path, file size in bytes, and size in MB.
 */
export const create720pVersion = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      try {
        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video"
        );
        const duration = metadata.format.duration;
        const height = videoStream?.height || 0;
        const audioBitrate = 128; // kbps
        const targetSizeMB = 256;
        const targetTotalBitrate = Math.floor((targetSizeMB * 8192) / duration);
        const targetVideoBitrate = targetTotalBitrate - audioBitrate;

        if (height <= 720) {
          console.log(
            "Original video is 720p or lower, skipping 720p creation."
          );
          return resolve({
            success: true,
            outputPath,
            size: 0,
            actualSizeMB: 0,
          });
        } else {
          console.log(`Creating 720p version (original: ${height}p)`);

          ffmpeg(inputPath)
            .videoCodec("libx264")
            .videoBitrate(targetVideoBitrate)
            .size("?x720")
            .audioCodec("aac")
            .audioBitrate(audioBitrate)
            .addOutputOption("-preset medium")
            .addOutputOption("-movflags +faststart")
            .addOutputOption(`-maxrate ${targetVideoBitrate}k`)
            .addOutputOption(`-bufsize ${targetVideoBitrate * 2}k`)
            .output(outputPath)
            .on("start", (commandLine) => {
              console.log("FFmpeg 720p command:", commandLine);
            })
            .on("progress", (progress) => {
              if (progress.percent) {
                console.log(
                  `Creating 720p: ${Math.floor(progress.percent)}% done`
                );
              }
            })
            .on("end", () => {
              const stats = fs.statSync(outputPath);
              console.log(
                `720p version created: ${(stats.size / (1024 * 1024)).toFixed(
                  2
                )} MB`
              );
              resolve({
                success: true,
                outputPath,
                size: stats.size,
                actualSizeMB: stats.size / (1024 * 1024),
              });
            })
            .on("error", (err) => {
              console.error("FFmpeg 720p error:", err);
              reject(err);
            })
            .run();
        }
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};
