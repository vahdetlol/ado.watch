const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Videodan thumbnail oluştur (ilk kare)
 * @param {string} inputPath - Video dosya yolu
 * @param {string} outputPath - Thumbnail çıkış yolu
 * @returns {Promise<string>} - Thumbnail dosya yolu
 */
function extractThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 "${outputPath}" -y`;
    exec(command, (err) => {
      if (err) return reject(err);
      resolve(outputPath);
    });
  });
}

/**
 * Video süresini al
 * @param {string} inputPath - Video dosya yolu
 * @returns {Promise<number>} - Saniye cinsinden süre
 */
function getDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    exec(command, (err, stdout) => {
      if (err) return reject(err);
      resolve(parseFloat(stdout));
    });
  });
}

/**
 * Video bilgilerini al (genişlik, yükseklik, codec, vb.)
 * @param {string} inputPath - Video dosya yolu
 * @returns {Promise<Object>} - Video metadata
 */
function getVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    const command = `ffprobe -v error -show_entries stream=width,height,codec_name -of json "${inputPath}"`;
    exec(command, (err, stdout) => {
      if (err) return reject(err);
      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams.find(s => s.codec_type === 'video' || s.width);
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
}

module.exports = {
  extractThumbnail,
  getDuration,
  getVideoInfo
};
