const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function extractThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 "${outputPath}" -y`;
    exec(command, (err) => {
      if (err) return reject(err);
      resolve(outputPath);
    });
  });
}

function getDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    exec(command, (err, stdout) => {
      if (err) return reject(err);
      resolve(parseFloat(stdout));
    });
  });
}

module.exports = {
  extractThumbnail,
  getDuration
};
