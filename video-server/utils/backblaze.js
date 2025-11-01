import B2 from 'backblaze-b2';
import fs from 'fs';
import path from 'path';

// Backblaze B2 client
let b2Client = null;
let authData = null;

/**
 * Initialize Backblaze B2 client
 */
const initializeB2 = async () => {
  if (b2Client && authData) {
    return { b2: b2Client, auth: authData };
  }

  const applicationKeyId = process.env.B2_APPLICATION_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!applicationKeyId || !applicationKey) {
    throw new Error('Backblaze B2 credentials not found in environment variables');
  }

  b2Client = new B2({
    applicationKeyId,
    applicationKey,
  });

  try {
    authData = await b2Client.authorize();
    console.log(' Backblaze B2 authorized successfully');
    return { b2: b2Client, auth: authData };
  } catch (error) {
    console.error(' Backblaze B2 authorization failed:', error);
    throw new Error(`B2 authorization failed: ${error.message}`);
  }
};

/**
 * Upload file to Backblaze B2
 * @param {string} localFilePath - Local file path
 * @param {string} b2FileName - File name in B2 bucket
 * @param {string} bucketId - B2 bucket ID (optional, uses env var if not provided)
 * @returns {Promise<Object>} - Upload result with file ID and URL
 */
const uploadToB2 = async (localFilePath, b2FileName, bucketId = null) => {
  try {
    const { b2, auth } = await initializeB2();
    
    const targetBucketId = bucketId || process.env.B2_BUCKET_ID;
    if (!targetBucketId) {
      throw new Error('B2_BUCKET_ID not found in environment variables');
    }

    // Get upload URL
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: targetBucketId,
    });

    // Read file
    const fileData = fs.readFileSync(localFilePath);
    const fileName = b2FileName || path.basename(localFilePath);

    console.log(` Uploading to B2: ${fileName}`);

    // Upload file
    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: fileName,
      data: fileData,
    });

    console.log(` Upload successful: ${fileName}`);

    // Generate file URL
    const bucketName = process.env.B2_BUCKET_NAME;
    const fileUrl = bucketName 
      ? `https://${bucketName}.s3.eu-central-003.backblazeb2.com/${fileName}`
      : null;

    return {
      success: true,
      fileId: uploadResponse.data.fileId,
      fileName: uploadResponse.data.fileName,
      fileUrl: fileUrl,
      size: uploadResponse.data.contentLength,
    };
  } catch (error) {
    console.error(' B2 upload error:', error);
    throw new Error(`B2 upload failed: ${error.message}`);
  }
};

/**
 * Delete file from Backblaze B2
 * @param {string} fileId - B2 file ID
 * @param {string} fileName - File name
 * @returns {Promise<Object>} - Delete result
 */
const deleteFromB2 = async (fileId, fileName) => {
  try {
    const { b2 } = await initializeB2();

    console.log(` Deleting from B2: ${fileName}`);

    await b2.deleteFileVersion({
      fileId: fileId,
      fileName: fileName,
    });

    console.log(` Delete successful: ${fileName}`);

    return {
      success: true,
      message: 'File deleted successfully',
    };
  } catch (error) {
    console.error(' B2 delete error:', error);
    throw new Error(`B2 delete failed: ${error.message}`);
  }
};

/**
 * Upload video and thumbnail to B2, then delete local files
 * @param {string} videoPath - Local video file path
 * @param {string} thumbnailPath - Local thumbnail file path (optional)
 * @returns {Promise<Object>} - Upload result with B2 URLs
 */
const uploadVideoToB2 = async (videoPath, thumbnailPath = null) => {
  try {
    const results = {
      video: null,
      video720p: null,
      thumbnail: null,
    };

    // Upload main video
    if (videoPath && fs.existsSync(videoPath)) {
      const videoFileName = `videos/${path.basename(videoPath)}`;
      results.video = await uploadToB2(videoPath, videoFileName);
      
      // Delete local video file after successful upload
      fs.unlinkSync(videoPath);
      console.log(` Local video deleted: ${videoPath}`);
    }

    // Upload thumbnail if exists
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      const thumbFileName = `thumbnails/${path.basename(thumbnailPath)}`;
      results.thumbnail = await uploadToB2(thumbnailPath, thumbFileName);
      
      // Delete local thumbnail file after successful upload
      fs.unlinkSync(thumbnailPath);
      console.log(` Local thumbnail deleted: ${thumbnailPath}`);
    }

    return results;
  } catch (error) {
    console.error(' Video upload to B2 failed:', error);
    throw error;
  }
};

/**
 * Upload multiple versions of video (1080p, 720p) and thumbnail to B2
 * @param {string} videoPath - Main video path (1080p)
 * @param {string} video720pPath - 720p video path (optional)
 * @param {string} thumbnailPath - Thumbnail path (optional)
 * @returns {Promise<Object>} - Upload results
 */
const uploadMultipleVersionsToB2 = async (videoPath, video720pPath = null, thumbnailPath = null) => {
  try {
    const results = {
      video: null,
      video720p: null,
      thumbnail: null,
    };

    // Upload main video (1080p)
    if (videoPath && fs.existsSync(videoPath)) {
      const videoFileName = `videos/${path.basename(videoPath)}`;
      results.video = await uploadToB2(videoPath, videoFileName);
      fs.unlinkSync(videoPath);
      console.log(` Local video deleted: ${videoPath}`);
    }

    // Upload 720p version
    if (video720pPath && fs.existsSync(video720pPath)) {
      const video720pFileName = `videos/${path.basename(video720pPath)}`;
      results.video720p = await uploadToB2(video720pPath, video720pFileName);
      fs.unlinkSync(video720pPath);
      console.log(` Local 720p video deleted: ${video720pPath}`);
    }

    // Upload thumbnail
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      const thumbFileName = `thumbnails/${path.basename(thumbnailPath)}`;
      results.thumbnail = await uploadToB2(thumbnailPath, thumbFileName);
      fs.unlinkSync(thumbnailPath);
      console.log(` Local thumbnail deleted: ${thumbnailPath}`);
    }

    return results;
  } catch (error) {
    console.error(' Multiple versions upload to B2 failed:', error);
    throw error;
  }
};

/**
 * Get file info from Backblaze B2
 * @param {string} fileId - B2 file ID
 * @returns {Promise<Object>} - File information
 */
const getFileInfo = async (fileId) => {
  try {
    const { b2 } = await initializeB2();

    const response = await b2.getFileInfo({
      fileId: fileId,
    });

    return response.data;
  } catch (error) {
    console.error(' B2 get file info error:', error);
    throw new Error(`B2 get file info failed: ${error.message}`);
  }
};

export {
  initializeB2,
  uploadToB2,
  deleteFromB2,
  uploadVideoToB2,
  uploadMultipleVersionsToB2,
  getFileInfo,
};
