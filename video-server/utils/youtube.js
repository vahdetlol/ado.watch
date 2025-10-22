import youtubedl from '@openanime/youtube-dl-exec';
import path from 'path';
import fs from 'fs';

/**
 * YouTube'dan video indir
 * @param {string} url - YouTube video URL'i
 * @param {string} outputDir - Videonun kaydedileceği klasör
 * @param {boolean} isPlaylist - Playlist mi indiriliyor
 * @returns {Promise<Object>} - İndirilen video bilgileri
 */
const downloadFromYouTube = async (url, outputDir, isPlaylist = false) => {
  try {
    // Klasör yoksa oluştur
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`📂 Output directory: ${outputDir}`);

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputTemplate = path.join(outputDir, `${filename}.%(ext)s`);

    // Video bilgilerini al
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      noPlaylist: !isPlaylist,
    });

    console.log(`📹 Video title: ${info.title}`);
    console.log(`⏱️  Duration: ${info.duration}s`);

    // Videoyu indir
    await youtubedl(url, {
      output: outputTemplate,
      format: 'bestvideo[ext=mp4][height<=2160]+bestaudio[ext=m4a]/best[ext=mp4][height<=2160]/best',
      noWarnings: true,
      noCallHome: true,
      noPlaylist: !isPlaylist,
      mergeOutputFormat: 'mp4',
    });

    // İndirilen dosyayı bul (youtube-dl .mp4 veya .mkv olarak kaydedebilir)
    const possibleExtensions = ['.mp4', '.mkv', '.webm'];
    let outputPath = null;

    for (const ext of possibleExtensions) {
      const testPath = path.join(outputDir, `${filename}${ext}`);
      if (fs.existsSync(testPath)) {
        outputPath = testPath;
        console.log(`✅ File found: ${testPath}`);
        break;
      }
    }

    if (!outputPath) {
      // Klasördeki en son oluşturulan dosyayı bul
      const files = fs.readdirSync(outputDir);
      const recentFiles = files
        .filter(f => f.startsWith(filename))
        .map(f => ({
          name: f,
          path: path.join(outputDir, f),
          time: fs.statSync(path.join(outputDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (recentFiles.length > 0) {
        outputPath = recentFiles[0].path;
        console.log(`✅ Found downloaded file: ${outputPath}`);
      } else {
        throw new Error('İndirilen video dosyası bulunamadı');
      }
    }

    // Dosya boyutunu al
    const stats = fs.statSync(outputPath);
    console.log(`📦 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

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
    throw new Error(`YouTube'dan indirme başarısız: ${error.message}`);
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
    throw new Error(`YouTube bilgileri alınamadı: ${error.message}`);
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
      throw new Error('Bu bir playlist değil');
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
    throw new Error(`Playlist bilgileri alınamadı: ${error.message}`);
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
    console.log(`📋 Playlist: ${playlistInfo.title} (${playlistInfo.videoCount} video)`);

    const downloadedVideos = [];

    // Her videoyu tek tek indir
    for (let i = 0; i < playlistInfo.videos.length; i++) {
      const videoInfo = playlistInfo.videos[i];
      console.log(`\n[${i + 1}/${playlistInfo.videoCount}] İndiriliyor: ${videoInfo.title}`); 

      try {
        const result = await downloadFromYouTube(videoInfo.url, outputDir, false);
        downloadedVideos.push({
          ...result,
          playlistIndex: i + 1,
          playlistTitle: playlistInfo.title
        });
        console.log(`✅ Tamamlandı: ${videoInfo.title}`);
      } catch (error) {
        console.error(`❌ Hata (${videoInfo.title}):`, error.message);
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
    throw new Error(`Playlist indirilemedi: ${error.message}`);
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
