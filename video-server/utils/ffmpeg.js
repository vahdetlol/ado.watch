import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Create a thumbnail from a video (first frame)
 * @param {string} inputPath - Video file path
 * @param {string} outputPath - Thumbnail output path
 * @returns {Promise<string>} - Thumbnail file path
 */
export const extractThumbnail = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x240'
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err));
  });
};

/**
 * Get video duration
 * @param {string} inputPath - Video file path
 * @returns {Promise<number>} - Duration in seconds
 */
export const getDuration = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

/**
 * Get video information (width, height, codec, etc.)
 * @param {string} inputPath - Video file path
 * @returns {Promise<Object>} - Video metadata
 */
export const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          codec: videoStream?.codec_name || null,
          duration: metadata.format.duration || 0
        });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};

/**
 * Process and compress video to target size with resolution check
 * @param {string} inputPath - Input video file path
 * @param {string} outputPath - Output video file path
 * @param {number} targetSizeMB - Target file size in MB (default: 512)
 * @returns {Promise<Object>} - Processing result with file info
 */
export const processVideo = (inputPath, outputPath, targetSizeMB = 512) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const duration = metadata.format.duration;
        const height = videoStream?.height || 0;
        const width = videoStream?.width || 0;

        console.log(`Processing video: ${width}x${height}, duration: ${duration}s`);

        // Calculate bitrate for target size
        // Formula: (targetSizeMB * 8192) / duration - audioBitrate
        const audioBitrate = 128; // kbps
        const targetTotalBitrate = Math.floor((targetSizeMB * 8192) / duration);
        const targetVideoBitrate = targetTotalBitrate - audioBitrate;

        console.log(`Target bitrate: ${targetVideoBitrate}k (total: ${targetTotalBitrate}k)`);

        // Build ffmpeg command
        let command = ffmpeg(inputPath)
          .videoCodec('libx264')
          .videoBitrate(targetVideoBitrate)
          .audioCodec('aac')
          .audioBitrate(audioBitrate)
          .addOutputOption('-preset medium')
          .addOutputOption('-movflags +faststart')
          .addOutputOption(`-maxrate ${targetVideoBitrate}k`)
          .addOutputOption(`-bufsize ${targetVideoBitrate * 2}k`);

        // Scale down if height > 1080p (don't upscale if smaller)
        if (height > 1080) {
          console.log(`Scaling down from ${height}p to 1080p`);
          command = command.size('?x1080');
        } else {
          console.log(`Keeping original resolution: ${width}x${height}`);
        }

        command
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${Math.floor(progress.percent)}% done`);
            }
          })
          .on('end', () => {
            // Get output file stats
            const stats = fs.statSync(outputPath);
            console.log(`✓ Video processed: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
            resolve({
              success: true,
              outputPath,
              size: stats.size,
              targetSizeMB,
              actualSizeMB: stats.size / (1024 * 1024)
            });
          })
          .on('error', (err) => {
            console.error('FFmpeg processing error:', err);
            reject(err);
          })
          .run();

      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};

/**
 * Create 720p version of a video
 * @param {string} inputPath - Input video file path
 * @param {string} outputPath - Output video file path (720p)
 * @returns {Promise<Object>} - Processing result with file info
 */
export const create720pVersion = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const duration = metadata.format.duration;
        const height = videoStream?.height || 0;

        console.log(`Creating 720p version (original: ${height}p)`);

        // Calculate appropriate bitrate for 720p
        // Targeting roughly 256MB for 720p version
        const audioBitrate = 128; // kbps
        const targetSizeMB = 256;
        const targetTotalBitrate = Math.floor((targetSizeMB * 8192) / duration);
        const targetVideoBitrate = targetTotalBitrate - audioBitrate;

        ffmpeg(inputPath)
          .videoCodec('libx264')
          .videoBitrate(targetVideoBitrate)
          .size('?x720') // Scale to 720p height
          .audioCodec('aac')
          .audioBitrate(audioBitrate)
          .addOutputOption('-preset medium')
          .addOutputOption('-movflags +faststart')
          .addOutputOption(`-maxrate ${targetVideoBitrate}k`)
          .addOutputOption(`-bufsize ${targetVideoBitrate * 2}k`)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg 720p command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Creating 720p: ${Math.floor(progress.percent)}% done`);
            }
          })
          .on('end', () => {
            const stats = fs.statSync(outputPath);
            console.log(`✓ 720p version created: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
            resolve({
              success: true,
              outputPath,
              size: stats.size,
              actualSizeMB: stats.size / (1024 * 1024)
            });
          })
          .on('error', (err) => {
            console.error('FFmpeg 720p error:', err);
            reject(err);
          })
          .run();

      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};
