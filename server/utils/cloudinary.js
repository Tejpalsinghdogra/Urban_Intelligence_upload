import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload base64 image to a dedicated Cloudinary folder
 * @param {string} imageBase64 - Base64 image data or data URI
 * @param {string} type - 'pothole' or 'vehicle'
 * @returns {Promise<string|null>} - Secure URL of uploaded image
 */
export async function uploadToCloudinary(imageBase64, type = 'defect') {
  try {
    dotenv.config();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    const folderName = process.env.CLOUDINARY_FOLDER?.trim() || 'urban_intelligence/road_defects';

    // Check if Cloudinary credentials are provided
    if (!cloudName || !apiKey || !apiSecret || cloudName === 'your_cloudinary_cloud_name') {
      console.warn('[Cloudinary] Notice: Cloudinary credentials not fully configured in .env. Skipping cloud upload.');
      return null;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    
    // Format data URI if needed
    const dataUri = imageBase64.startsWith('data:image')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    console.log(`[Cloudinary] Uploading verified ${type} snapshot to folder: "${folderName}"...`);

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: folderName,
      resource_type: 'image',
      tags: ['urban_intelligence', type, 'verified_defect']
    });

    console.log(`[Cloudinary] Image uploaded successfully: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error('[Cloudinary Upload Error]:', error.message);
    return null;
  }
}

/**
 * Delete all archived images in the Cloudinary road defects folder
 */
export async function deleteCloudinaryFolderImages() {
  try {
    dotenv.config();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    const folderName = process.env.CLOUDINARY_FOLDER?.trim() || 'urban_intelligence/road_defects';

    if (!cloudName || !apiKey || !apiSecret || cloudName === 'your_cloudinary_cloud_name') {
      return null;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    console.log(`[Cloudinary] Deleting all images with prefix: "${folderName}/"...`);
    
    // Delete all resources matching the folder prefix
    const result = await cloudinary.api.delete_resources_by_prefix(`${folderName}/`);
    console.log('[Cloudinary] Successfully deleted images from folder:', result);
    return result;
  } catch (error) {
    console.error('[Cloudinary Deletion Error]:', error.message);
    return null;
  }
}

export default cloudinary;

