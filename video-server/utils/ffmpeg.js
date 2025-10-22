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
          codec: videoStream?.codec_name || null
        });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};
