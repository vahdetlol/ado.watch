import youtubedl from "@openanime/youtube-dl-exec";
import path from "path";
import fs from "fs";
import { sendProgress } from "./progressNotifier.js";
import { createLogger } from "./logger.js";

const logger = createLogger("YOUTUBE");

const downloadFromYouTube = async (
  url,
  outputDir,
  isPlaylist = false,
  format = "best[ext=mp4]/best"
) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    logger.debug(`Output directory: ${outputDir}`);

    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      noPlaylist: !isPlaylist,
    });

    logger.info(`Video title: ${info.title}`);
    logger.debug(`Duration: ${info.duration}s`);

    const existingFiles = fs.readdirSync(outputDir);

    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputTemplate = path.join(outputDir, `${uniqueId}.%(ext)s`);

    logger.info(`Downloading with format: ${format}...`);
    await youtubedl(url, {
      output: outputTemplate,
      format: format,
      noWarnings: true,
      noCallHome: true,
      noPlaylist: !isPlaylist,
    });

    logger.debug("Searching for downloaded file...");

    const currentFiles = fs.readdirSync(outputDir);
    const newFiles = currentFiles.filter((f) => !existingFiles.includes(f));

    logger.debug(`New files found:`, newFiles);

    if (newFiles.length === 0) {
      const matchingFiles = currentFiles.filter((f) =>
        f.startsWith(uniqueId.split("-")[0])
      );
      if (matchingFiles.length > 0) {
        newFiles.push(matchingFiles[0]);
      }
    }

    if (newFiles.length === 0) {
      throw new Error("No downloaded file found");
    }

    const downloadedFile = newFiles[0];
    const outputPath = path.join(outputDir, downloadedFile);

    const stats = fs.statSync(outputPath);
    logger.info(`Downloaded: ${downloadedFile}`);
    logger.debug(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return {
      success: true,
      filename: outputPath,
      originalName: info.title || "YouTube Video",
      title: info.title,
      description: info.description,
      duration: info.duration,
      thumbnail: info.thumbnail,
      size: stats.size,
      mimeType: "video/mp4",
    };
  } catch (error) {
    logger.error("YouTube download error:", error);
    throw new Error(`YouTube download failed: ${error.message}`);
  }
};

const downloadAllResolutions = async (url, outputDir, pid = null) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    logger.info("Fetching available formats for video...");

    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noPlaylist: true,
    });

    logger.info(`Video: ${info.title}`);

    const videoFormats = info.formats
      .filter(
        (f) =>
          f.ext === "mp4" &&
          f.vcodec !== "none" &&
          f.acodec !== "none" &&
          f.height &&
          f.width
      )
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    const uniqueResolutions = [];
    const seenResolutions = new Set();

    for (const format of videoFormats) {
      const isVertical = format.height > format.width;
      const resolutionValue = isVertical ? format.width : format.height;
      const resolutionKey = `${resolutionValue}p`;

      if (!seenResolutions.has(resolutionKey)) {
        seenResolutions.add(resolutionKey);
        uniqueResolutions.push({
          ...format,
          isVertical,
          resolutionValue,
          resolutionName: resolutionKey,
        });
      }
    }

    uniqueResolutions.sort((a, b) => b.resolutionValue - a.resolutionValue);

    logger.info(`Found ${uniqueResolutions.length} unique resolutions:`);
    uniqueResolutions.forEach((f) => {
      const orientation = f.isVertical ? "vertical" : "horizontal";
      logger.debug(
        `  - ${f.resolutionName} (${f.width}x${f.height}, ${orientation}) - ${(
          (f.filesize || 0) /
          1024 /
          1024
        ).toFixed(2)} MB`
      );
    });

    const downloadedVideos = [];
    const resolutionProgress = {};

    for (let i = 0; i < uniqueResolutions.length; i++) {
      const format = uniqueResolutions[i];
      const resolution = format.resolutionName;
      logger.info(
        `[${i + 1}/${uniqueResolutions.length}] Downloading ${resolution} (${
          format.width
        }x${format.height})...`
      );
      const baseProgress = 10;
      const downloadSpacePerResolution = 40 / uniqueResolutions.length;
      const currentOverallProgress =
        baseProgress + i * downloadSpacePerResolution;

      try {
        resolutionProgress[resolution] = 0;
        if (pid) {
          await sendProgress(
            pid,
            Math.round(currentOverallProgress),
            `downloading_${resolution}`,
            {
              resolutions: resolutionProgress,
              currentResolution: resolution,
              totalResolutions: uniqueResolutions.length,
              completedResolutions: i,
            }
          );
        }

        const existingFiles = fs.readdirSync(outputDir);
        const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const outputTemplate = path.join(
          outputDir,
          `${uniqueId}-${resolution}.%(ext)s`
        );

        await youtubedl(url, {
          output: outputTemplate,
          format: format.format_id,
          noWarnings: true,
          noCallHome: true,
          noPlaylist: true,
        });

        const currentFiles = fs.readdirSync(outputDir);
        const newFiles = currentFiles.filter((f) => !existingFiles.includes(f));

        if (newFiles.length === 0) {
          const matchingFiles = currentFiles.filter((f) =>
            f.includes(resolution)
          );
          if (matchingFiles.length > 0) {
            newFiles.push(matchingFiles[matchingFiles.length - 1]);
          }
        }

        if (newFiles.length > 0) {
          const downloadedFile = newFiles[0];
          const outputPath = path.join(outputDir, downloadedFile);
          const stats = fs.statSync(outputPath);

          downloadedVideos.push({
            success: true,
            filename: outputPath,
            originalName: `${info.title} - ${resolution}`,
            title: info.title,
            resolution: resolution,
            height: format.height,
            width: format.width,
            isVertical: format.isVertical,
            formatId: format.format_id,
            size: stats.size,
            mimeType: "video/mp4",
          });
          resolutionProgress[resolution] = 100;
          if (pid) {
            await sendProgress(
              pid,
              Math.round(currentOverallProgress + downloadSpacePerResolution),
              `completed_${resolution}`,
              {
                resolutions: resolutionProgress,
                currentResolution: resolution,
                totalResolutions: uniqueResolutions.length,
                completedResolutions: i + 1,
              }
            );
          }

          logger.info(
            `Downloaded ${resolution}: ${(stats.size / 1024 / 1024).toFixed(
              2
            )} MB`
          );
        } else {
          throw new Error(`File not found for ${resolution}`);
        }
      } catch (error) {
        logger.error(`Error downloading ${resolution}:`, error.message);
        resolutionProgress[resolution] = -1;
        downloadedVideos.push({
          error: true,
          resolution: resolution,
          message: error.message,
        });
      }
    }

    return {
      success: true,
      title: info.title,
      description: info.description,
      duration: info.duration,
      thumbnail: info.thumbnail,
      totalResolutions: uniqueResolutions.length,
      downloadedCount: downloadedVideos.filter((v) => v.success).length,
      videos: downloadedVideos,
    };
  } catch (error) {
    logger.error("Error fetching video formats:", error);
    throw new Error(`Failed to download all resolutions: ${error.message}`);
  }
};

const getYouTubeInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noPlaylist: true,
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
    throw new Error(
      `YouTube information could not be retrieved: ${error.message}`
    );
  }
};

const getPlaylistInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      noCallHome: true,
    });

    if (!info.entries || !Array.isArray(info.entries)) {
      throw new Error("This is not a playlist");
    }

    return {
      title: info.title || "Untitled Playlist",
      playlistId: info.id,
      uploader: info.uploader || info.channel,
      videoCount: info.entries.length,
      videos: info.entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        duration: entry.duration,
        url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
      })),
    };
  } catch (error) {
    throw new Error(
      `Playlist information could not be retrieved: ${error.message}`
    );
  }
};

const downloadPlaylist = async (playlistUrl, outputDir) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const playlistInfo = await getPlaylistInfo(playlistUrl);
    logger.info(
      `Playlist: ${playlistInfo.title} (${playlistInfo.videoCount} video)`
    );

    const downloadedVideos = [];

    for (let i = 0; i < playlistInfo.videos.length; i++) {
      const videoInfo = playlistInfo.videos[i];
      logger.info(
        `[${i + 1}/${playlistInfo.videoCount}] Downloading: ${videoInfo.title}`
      );

      try {
        const result = await downloadFromYouTube(
          videoInfo.url,
          outputDir,
          false
        );
        downloadedVideos.push({
          ...result,
          playlistIndex: i + 1,
          playlistTitle: playlistInfo.title,
        });
        logger.info(`Completed: ${videoInfo.title}`);
      } catch (error) {
        logger.error(`Error (${videoInfo.title}):`, error.message);
        downloadedVideos.push({
          error: true,
          title: videoInfo.title,
          message: error.message,
        });
      }
    }

    return downloadedVideos;
  } catch (error) {
    throw new Error(`Playlist could not be downloaded: ${error.message}`);
  }
};

const isYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
};

const isPlaylistUrl = (url) => {
  const playlistRegex = /[?&]list=([a-zA-Z0-9_-]+)/;
  return playlistRegex.test(url);
};

export {
  downloadFromYouTube,
  downloadAllResolutions,
  getYouTubeInfo,
  getPlaylistInfo,
  downloadPlaylist,
  isYouTubeUrl,
  isPlaylistUrl,
};
