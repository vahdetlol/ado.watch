import { Route } from "owebjs";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Video from "../../models/Video.js";
import { downloadAllResolutions, isYouTubeUrl } from "../../utils/youtube.js";
import { uploadAllResolutionsToB2 } from "../../utils/backblaze.js";
import {
  sendProgress,
  sendComplete,
  sendError,
  getProcessId,
} from "../../utils/progressNotifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const videoDir = path.join(__dirname, "..", "..", "uploads", "videos");
const thumbDir = path.join(__dirname, "..", "..", "uploads", "thumbnails");

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const downloadThumbnail = (thumbnailUrl, outputPath) => {
  return new Promise((resolve, reject) => {
    const protocol = thumbnailUrl.startsWith("https") ? https : http;

    protocol
      .get(thumbnailUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`Thumbnail download failed: ${response.statusCode}`)
          );
          return;
        }

        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          resolve(outputPath);
        });

        fileStream.on("error", (err) => {
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export default class extends Route {
  async handle(req, reply) {
    const pid = getProcessId(req);
    let thumbPath = null;
    const downloadedFiles = [];

    try {
      const { url, title, description, categories, tags, _user } = req.body;

      if (!url) {
        return reply.status(400).send({
          success: false,
          error: "YouTube URL is required",
        });
      }

      if (!_user || !_user._id) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
        });
      }

      if (!isYouTubeUrl(url)) {
        return reply.status(400).send({
          success: false,
          error: "Invalid YouTube URL",
        });
      }

      await sendProgress(pid, 10, "starting");
      console.log(`Downloading all resolutions: ${url}`);

      const downloadResult = await downloadAllResolutions(url, videoDir, pid);

      if (!downloadResult.success) {
        await sendError(pid, new Error("Download failed"));
        return reply.status(500).send({
          success: false,
          error: "Download failed",
        });
      }

      await sendProgress(pid, 52, "processing_thumbnail");
      const thumbFilename = `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}.jpg`;
      thumbPath = path.join(thumbDir, thumbFilename);

      try {
        if (downloadResult.thumbnail) {
          await downloadThumbnail(downloadResult.thumbnail, thumbPath);
          console.log(`Thumbnail downloaded: ${thumbFilename}`);
        }
      } catch (thumbError) {
        console.warn("Thumbnail download failed:", thumbError.message);
        thumbPath = null; // Reset eğer başarısız olduysa
      }

      const successfulVideos = downloadResult.videos.filter((v) => v.success);

      // Track downloaded files for cleanup
      successfulVideos.forEach((v) => {
        if (v.filename) downloadedFiles.push(v.filename);
      });

      if (successfulVideos.length === 0) {
        await sendError(pid, new Error("No videos downloaded successfully"));
        return reply.status(500).send({
          success: false,
          error: "No videos downloaded successfully",
        });
      }

      await sendProgress(pid, 55, "uploading");
      console.log("Uploading all resolutions to Backblaze B2...");
      const b2Results = await uploadAllResolutionsToB2(
        successfulVideos,
        thumbPath && fs.existsSync(thumbPath) ? thumbPath : null,
        pid
      );

      await sendProgress(pid, 95, "saving");
      const video = new Video({
        title: title || downloadResult.title,
        description: description || downloadResult.description || "",
        resolutions: b2Results.resolutions.map((res) => ({
          resolution: res.resolution,
          url: res.fileUrl,
          size: res.size,
          width: res.width,
          height: res.height,
          b2FileId: res.fileId,
        })),
        mimeType: "video/mp4",
        thumbnail: b2Results.thumbnail?.fileUrl || null,
        duration: Math.floor(downloadResult.duration || 0),
        categories: categories || [],
        tags: tags || [],
        uploader: _user._id,
      });

      await video.save();

      console.log(
        `Video saved with ${b2Results.resolutions.length} resolutions: ${video.title}`
      );
      console.log("Youtube video downloaded by ", _user.username);

      const result = {
        success: true,
        video: {
          id: video._id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          duration: video.duration,
          resolutions: video.resolutions.map((r) => ({
            resolution: r.resolution,
            size: r.size,
          })),
        },
      };

      await sendComplete(pid, result);
      return reply.status(201).send(result);
    } catch (error) {
      console.error("YouTube download error:", error);
      await sendError(pid, error);

      // Cleanup temp files on error
      downloadedFiles.forEach((file) => {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Cleaned up temp file: ${file}`);
          }
        } catch (cleanupError) {
          console.warn(`Failed to cleanup ${file}:`, cleanupError.message);
        }
      });

      if (thumbPath && fs.existsSync(thumbPath)) {
        try {
          fs.unlinkSync(thumbPath);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup thumbnail:`, cleanupError.message);
        }
      }

      return reply.status(500).send({
        success: false,
        error: "YouTube download failed",
        message: error.message,
      });
    }
  }
}
