import fs from 'fs';
import crypto from 'crypto';

export interface UploadedMediaResult {
  url: string;
  provider: 'cloudinary' | 'local';
  publicId?: string;
}

function parseCloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'TU_CLOUD_NAME'
  ) {
    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      apiKey: process.env.CLOUDINARY_API_KEY.trim(),
      apiSecret: process.env.CLOUDINARY_API_SECRET.trim(),
    };
  }

  // Soporte formato CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  const urlEnv = process.env.CLOUDINARY_URL;
  if (urlEnv && urlEnv.startsWith('cloudinary://')) {
    try {
      const parsed = new URL(urlEnv);
      return {
        cloudName: parsed.hostname,
        apiKey: decodeURIComponent(parsed.username),
        apiSecret: decodeURIComponent(parsed.password),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Sube un archivo multimedia a Cloudinary CDN si las credenciales están activas,
 * o devuelve la ruta local servida por Express como fallback transparente.
 */
export async function processUploadedMedia(
  localFilePath: string,
  localPublicPath: string,
  folder = 'kabaly_media'
): Promise<UploadedMediaResult> {
  const config = parseCloudinaryConfig();
  if (!config) {
    return {
      url: localPublicPath,
      provider: 'local',
    };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${config.apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const fileBuffer = await fs.promises.readFile(localFilePath);
    const base64Data = `data:application/octet-stream;base64,${fileBuffer.toString('base64')}`;

    const formBody = new URLSearchParams();
    formBody.append('file', base64Data);
    formBody.append('api_key', config.apiKey);
    formBody.append('timestamp', timestamp);
    formBody.append('folder', folder);
    formBody.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/auto/upload`,
      {
        method: 'POST',
        body: formBody,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[StorageService] Fallo en subida a Cloudinary, usando copia local:', errText);
      return { url: localPublicPath, provider: 'local' };
    }

    const result: any = await response.json();
    if (result && result.secure_url) {
      // Eliminar archivo temporal local para ahorrar disco en Hostinger
      fs.promises.unlink(localFilePath).catch(() => {});
      return {
        url: result.secure_url,
        provider: 'cloudinary',
        publicId: result.public_id,
      };
    }
  } catch (err: any) {
    console.warn('[StorageService] Error conectando con Cloudinary, usando almacenamiento local:', err.message);
  }

  return {
    url: localPublicPath,
    provider: 'local',
  };
}
