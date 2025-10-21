import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';

// FFmpeg binary yolunu ayarla
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Videodan thumbnail oluştur (ilk kare)
 * @param {string} inputPath - Video dosya yolu
 * @param {string} outputPath - Thumbnail çıkış yolu
 * @returns {Promise<string>} - Thumbnail dosya yolu
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
 * Video süresini al
 * @param {string} inputPath - Video dosya yolu
 * @returns {Promise<number>} - Saniye cinsinden süre
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
 * Video bilgilerini al (genişlik, yükseklik, codec, vb.)
 * @param {string} inputPath - Video dosya yolu
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
