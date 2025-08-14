// Configuration R2 pour le backend
// backend/src/config/r2.config.js

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Configuration du client S3 pour R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // Important pour R2
  forcePathStyle: false,
});

// Configuration CORS pour les réponses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Ou spécifiez vos domaines
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Length, X-Requested-With',
  'Access-Control-Max-Age': '3600'
};

/**
 * Génère une URL présignée pour upload direct depuis le frontend
 */
export async function generateUploadUrl(key, contentType, metadata = {}) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
    // Ajouter les headers CORS pour l'upload
    CacheControl: 'max-age=3600',
    // Permettre l'accès public en lecture après upload (optionnel)
    ACL: 'public-read'
  });

  // URL valide pendant 1 heure
  const url = await getSignedUrl(r2Client, command, { 
    expiresIn: 3600,
    // Headers que le client peut envoyer
    signableHeaders: new Set(['content-type', 'content-length', 'x-amz-meta-*'])
  });

  return url;
}

/**
 * Génère une URL présignée pour download
 */
export async function generateDownloadUrl(key, filename = null) {
  const params = {
    Bucket: process.env.R2_BUCKET,
    Key: key
  };

  // Si on veut forcer le téléchargement avec un nom spécifique
  if (filename) {
    params.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }

  const command = new GetObjectCommand(params);
  
  // URL valide pendant 5 minutes pour les previews, 1h pour les downloads
  const expiresIn = filename ? 3600 : 300;
  
  const url = await getSignedUrl(r2Client, command, { expiresIn });
  
  return url;
}

/**
 * Configuration pour upload direct depuis le frontend (sans passer par le backend)
 */
export function getDirectUploadConfig(key, contentType, fileSize) {
  return {
    url: `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`,
    fields: {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Cache-Control': 'max-age=31536000', // 1 an pour les fichiers immutables
    },
    headers: {
      ...corsHeaders
    }
  };
}

/**
 * Génère une URL publique pour un fichier (si bucket public)
 */
export function getPublicUrl(key) {
  // Si vous avez configuré un domaine personnalisé pour R2
  if (process.env.R2_PUBLIC_DOMAIN) {
    return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
  }
  
  // URL R2 standard (nécessite que le bucket soit public)
  return `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
