const cloudinary = require('cloudinary').v2;
const db = require('../config/db');

/**
 * Upload an image (base64 string or URL) to the tenant company's Cloudinary storage
 * @param {number} companyId 
 * @param {string} imageBase64OrUrl 
 * @param {string} folderSuffix 
 * @param {string} filename 
 * @returns {Promise<{success: boolean, url: string, public_id?: string, fallback?: boolean}>}
 */
async function uploadImageToCloudinary(companyId, imageBase64OrUrl, folderSuffix = 'service-jobs', filename = null) {
  if (!imageBase64OrUrl) {
    return { success: false, url: null, error: 'No image provided' };
  }

  // If already an external HTTP/HTTPS URL and not a base64 string, return it directly
  if (typeof imageBase64OrUrl === 'string' && (imageBase64OrUrl.startsWith('http://') || imageBase64OrUrl.startsWith('https://'))) {
    return { success: true, url: imageBase64OrUrl };
  }

  try {
    const comp = db.prepare(`
      SELECT cloudinary_enabled, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret, cloudinary_upload_preset, cloudinary_folder
      FROM companies
      WHERE id = ?
    `).get(companyId);

    // If company has enabled and configured Cloudinary
    if (comp && comp.cloudinary_enabled && comp.cloudinary_cloud_name && comp.cloudinary_api_key && comp.cloudinary_api_secret) {
      cloudinary.config({
        cloud_name: comp.cloudinary_cloud_name.trim(),
        api_key: comp.cloudinary_api_key.trim(),
        api_secret: comp.cloudinary_api_secret.trim(),
        secure: true
      });

      const targetFolder = (comp.cloudinary_folder || 'ac-pro/service-jobs').replace(/\/+$/, '');
      const fullFolder = `${targetFolder}/${folderSuffix}`.replace(/\/+/g, '/');

      const uploadOptions = {
        folder: fullFolder,
        resource_type: 'image',
        overwrite: true
      };

      if (filename) {
        uploadOptions.public_id = filename;
      }

      const res = await cloudinary.uploader.upload(imageBase64OrUrl, uploadOptions);

      return {
        success: true,
        url: res.secure_url,
        public_id: res.public_id,
        bytes: res.bytes,
        format: res.format
      };
    }

    // Fallback: If company has not configured Cloudinary, return the base64 / local string
    return {
      success: true,
      url: imageBase64OrUrl,
      fallback: true
    };
  } catch (err) {
    console.error('[Cloudinary Upload Error]:', err.message || err);
    // On Cloudinary upload failure, gracefully fallback to the original image so service job execution is not blocked
    return {
      success: false,
      url: imageBase64OrUrl,
      error: err.message || 'Failed to upload to Cloudinary',
      fallback: true
    };
  }
}

/**
 * Verify Cloudinary API Credentials
 * @param {{ cloud_name: string, api_key: string, api_secret: string }} config 
 */
async function testCloudinaryConnection({ cloud_name, api_key, api_secret }) {
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error('Cloud Name, API Key, and API Secret are required to test Cloudinary.');
  }

  cloudinary.config({
    cloud_name: String(cloud_name).trim(),
    api_key: String(api_key).trim(),
    api_secret: String(api_secret).trim(),
    secure: true
  });

  const res = await cloudinary.api.ping();
  return {
    success: true,
    message: `Connected successfully to Cloudinary cloud "${cloud_name}"! Status: ${res.status || 'OK'}`
  };
}

module.exports = {
  uploadImageToCloudinary,
  testCloudinaryConnection
};
