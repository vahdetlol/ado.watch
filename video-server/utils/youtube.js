import youtubedl from '@openanime/youtube-dl-exec';
import path from 'path';
import fs from 'fs';

/**
 * Download from YouTube
 * @param {string} url - YouTube video URL
 * @param {string} outputDir - Videos download path
 * @param {boolean} isPlaylist - Is it a Playlist
 * @returns {Promise<Object>} - Downloaded video information
 */
const downloadFromYouTube = async (url, outputDir, isPlaylist = false) => {
  try {
    // Create folder if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Output directory: ${outputDir}`);

  // Get video information
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      noPlaylist: !isPlaylist,
    });

    console.log(`Video title: ${info.title}`);
    console.log(`Duration: ${info.duration}s`);

  // Get current number of files first
    const existingFiles = fs.readdirSync(outputDir);
    const existingCount = existingFiles.length;

  // Create a unique file name
    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputTemplate = path.join(outputDir, `${uniqueId}.%(ext)s`);

  // Download the video
    console.log(`Downloading...`);
    await youtubedl(url, {
      output: outputTemplate,
      format: 'best[ext=mp4]/best',
      noWarnings: true,
      noCallHome: true,
      noPlaylist: !isPlaylist,
    });

    console.log(` Searching for downloaded file...`);
    
  // After downloading, find new files
    const currentFiles = fs.readdirSync(outputDir);
    const newFiles = currentFiles.filter(f => !existingFiles.includes(f));
    
    console.log(`New files found:`, newFiles);

    if (newFiles.length === 0) {
      // If no new file is found, search for files starting with uniqueId
      const matchingFiles = currentFiles.filter(f => f.startsWith(uniqueId.split('-')[0]));
      if (matchingFiles.length > 0) {
        newFiles.push(matchingFiles[0]);
      }
    }

    if (newFiles.length === 0) {
      throw new Error('No downloaded file found');
    }

  // Use the first new file
    const downloadedFile = newFiles[0];
    const outputPath = path.join(outputDir, downloadedFile);

  // Get file size
    const stats = fs.statSync(outputPath);
    console.log(`Downloaded: ${downloadedFile}`);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return {
      success: true,
      filename: outputPath,
      originalName: info.title || 'YouTube Video',
      title: info.title,
      description: info.description,
      duration: info.duration,
      thumbnail: info.thumbnail,
      size: stats.size,
      mimeType: 'video/mp4'
    };

  } catch (error) {
    console.error('YouTube download error:', error);
    throw new Error(`YouTube download failed: ${error.message}`);
  }
};

/**
 * Get YouTube video information (without downloading)
 * @param {string} url - YouTube video URL
 * @returns {Promise<Object>} - Video information
 */
const getYouTubeInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
  noPlaylist: true, // Only single video info
    });

    return {
      title: info.title,
      description: info.description,
      duration: info.duration,
      thumbnail: info.thumbnail,
      uploader: info.uploader,
      viewCount: info.view_count,
    };
  } catch (error) {
    throw new Error(`YouTube information could not be retrieved: ${error.message}`);
  }
};

/**
 * Get YouTube Playlist information
 * @param {string} url - YouTube playlist URL
 * @returns {Promise<Object>} - Playlist information
 */
const getPlaylistInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      noCallHome: true,
    });

    // Check if it's a playlist
    if (!info.entries || !Array.isArray(info.entries)) {
      throw new Error('This is not a playlist');
    }

    return {
      title: info.title || 'Untitled Playlist',
      playlistId: info.id,
      uploader: info.uploader || info.channel,
      videoCount: info.entries.length,
      videos: info.entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        duration: entry.duration,
        url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
      }))
    };
  } catch (error) {
    throw new Error(`Playlist information could not be retrieved: ${error.message}`);
  }
};

/**
 * Download all videos in a playlist
 * @param {string} playlistUrl - YouTube playlist URL
 * @param {string} outputDir - Directory where the video will be saved
 * @returns {Promise<Array>} - Downloaded videos
 */
const downloadPlaylist = async (playlistUrl, outputDir) => {
  try {
    // Create folder if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

  // Get playlist information
    const playlistInfo = await getPlaylistInfo(playlistUrl);
    console.log(`Playlist: ${playlistInfo.title} (${playlistInfo.videoCount} video)`);

    const downloadedVideos = [];

    // Download each video one by one
    for (let i = 0; i < playlistInfo.videos.length; i++) {
      const videoInfo = playlistInfo.videos[i];
      console.log(`\n[${i + 1}/${playlistInfo.videoCount}] Downloading: ${videoInfo.title}`);

      try {
        const result = await downloadFromYouTube(videoInfo.url, outputDir, false);
        downloadedVideos.push({
          ...result,
          playlistIndex: i + 1,
          playlistTitle: playlistInfo.title
        });
        console.log(`Completed: ${videoInfo.title}`);
      } catch (error) {
        console.error(`Error (${videoInfo.title}):`, error.message);
        // Continue even if one video fails
        downloadedVideos.push({
          error: true,
          title: videoInfo.title,
          message: error.message
        });
      }
    }

    return downloadedVideos;
  } catch (error) {
    throw new Error(`Playlist could not be downloaded: ${error.message}`);
  }
};

/**
 * Check if the URL is a YouTube link
 * @param {string} url - URL to check
 * @returns {boolean}
 */
const isYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
};

/**
 * Check if the URL is a YouTube Playlist link
 * @param {string} url - URL to check
 * @returns {boolean}
 */
const isPlaylistUrl = (url) => {
  const playlistRegex = /[?&]list=([a-zA-Z0-9_-]+)/;
  return playlistRegex.test(url);
};

export {
  downloadFromYouTube,
  getYouTubeInfo,
  getPlaylistInfo,
  downloadPlaylist,
  isYouTubeUrl,
  isPlaylistUrl
};
