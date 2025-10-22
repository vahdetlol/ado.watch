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
    // Klasör yoksa oluştur
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Output directory: ${outputDir}`);

    // Video bilgilerini al
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      noPlaylist: !isPlaylist,
    });

    console.log(`Video title: ${info.title}`);
    console.log(`Duration: ${info.duration}s`);

    // Önce mevcut dosya sayısını al
    const existingFiles = fs.readdirSync(outputDir);
    const existingCount = existingFiles.length;

    // Benzersiz dosya adı oluştur
    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputTemplate = path.join(outputDir, `${uniqueId}.%(ext)s`);

    // Videoyu indir
    console.log(`Downloading...`);
    await youtubedl(url, {
      output: outputTemplate,
      format: 'best[ext=mp4]/best',
      noWarnings: true,
      noCallHome: true,
      noPlaylist: !isPlaylist,
    });

    console.log(`🔍 Searching for downloaded file...`);
    
    // İndirdikten sonra yeni dosyaları bul
    const currentFiles = fs.readdirSync(outputDir);
    const newFiles = currentFiles.filter(f => !existingFiles.includes(f));
    
    console.log(`New files found:`, newFiles);

    if (newFiles.length === 0) {
      // Eğer yeni dosya bulunamazsa, uniqueId ile başlayan dosyaları ara
      const matchingFiles = currentFiles.filter(f => f.startsWith(uniqueId.split('-')[0]));
      if (matchingFiles.length > 0) {
        newFiles.push(matchingFiles[0]);
      }
    }

    if (newFiles.length === 0) {
      throw new Error('No downloaded file found');
    }

    // İlk yeni dosyayı kullan
    const downloadedFile = newFiles[0];
    const outputPath = path.join(outputDir, downloadedFile);

    // Dosya boyutunu al
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
 * YouTube video bilgilerini al (indirmeden)
 * @param {string} url - YouTube video URL'i
 * @returns {Promise<Object>} - Video bilgileri
 */
const getYouTubeInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noPlaylist: true, // Sadece tek video bilgisi
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
 * YouTube Playlist bilgilerini al
 * @param {string} url - YouTube playlist URL'i
 * @returns {Promise<Object>} - Playlist bilgileri
 */
const getPlaylistInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      noCallHome: true,
    });

    // Playlist mi kontrol et
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
 * Playlist'teki tüm videoları indir
 * @param {string} playlistUrl - YouTube playlist URL'i
 * @param {string} outputDir - Videonun kaydedileceği klasör
 * @returns {Promise<Array>} - İndirilen videolar
 */
const downloadPlaylist = async (playlistUrl, outputDir) => {
  try {
    // Klasör yoksa oluştur
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Playlist bilgilerini al
    const playlistInfo = await getPlaylistInfo(playlistUrl);
    console.log(`Playlist: ${playlistInfo.title} (${playlistInfo.videoCount} video)`);

    const downloadedVideos = [];

    // Her videoyu tek tek indir
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
        // Bir video hata verse bile devam et
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
 * URL'nin YouTube linki olup olmadığını kontrol et
 * @param {string} url - Kontrol edilecek URL
 * @returns {boolean}
 */
const isYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
};

/**
 * URL'nin YouTube Playlist linki olup olmadığını kontrol et
 * @param {string} url - Kontrol edilecek URL
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
