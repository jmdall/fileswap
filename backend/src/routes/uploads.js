import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { nanoid } from 'nanoid';
import config from '../config.js';
import { verifyAuth } from './sessions.js';
import { generatePreview } from '../services/preview.js';
import { scanFile } from '../services/scanner.js';

const s3Client = new S3Client(config.s3);

// Helper pour générer une URL présignée pour télécharger un objet S3
async function generatePresignedGetUrl(key, expiresIn = 300, responseContentDisposition = null) {
  const params = {
    Bucket: config.s3.bucket,
    Key: key
  };
  
  if (responseContentDisposition) {
    params.ResponseContentDisposition = responseContentDisposition;
  }
  
  const command = new GetObjectCommand(params);
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export default async function uploadRoutes(app) {
  // Obtenir une URL de mise en ligne présignée
  app.post('/presign', async (request, reply) => {
    const { filename, size, mimeType } = request.body;
    const { db } = app;
    const auth = await verifyAuth(request, reply);
    if (!auth) return;
    
    try {
      // Vérifications
      if (size > config.security.maxFileSize) {
        return reply.code(413).send({ 
          error: `File too large. Max size: ${config.security.maxFileSize} bytes` 
        });
      }
      
      // Vérifier qu'il n'y a pas déjà un fichier pour ce participant
      const existingFile = await db.query(
        `SELECT id FROM file_upload 
         WHERE session_id = $1 AND participant_id = $2 
         AND status != 'deleted'`,
        [auth.sessionId, auth.participantId]
      );
      
      if (existingFile.rows.length > 0) {
        return reply.code(409).send({ error: 'File already uploaded for this session' });
      }
      
      // Générer une clé unique pour S3
      const storageKey = `uploads/${auth.sessionId}/${auth.participantId}/${nanoid()}_${filename}`;
      
      // Créer l'entrée en base
      const fileResult = await db.query(
        `INSERT INTO file_upload 
         (session_id, participant_id, storage_key, filename, original_name, mime_type, size_bytes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploading')
         RETURNING id`,
        [auth.sessionId, auth.participantId, storageKey, filename, filename, mimeType, size]
      );
      
      const fileId = fileResult.rows[0].id;
      
      // Générer l'URL présignée pour PUT
      const command = new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: storageKey,
        ContentType: mimeType,
        ContentLength: size,
        Metadata: {
          'session-id': auth.sessionId,
          'participant-id': auth.participantId,
          'file-id': fileId
        }
      });
      
      const presignedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 3600 // 1 heure
      });
      
      reply.send({
        fileId,
        uploadUrl: presignedUrl,
        storageKey
      });
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to generate upload URL' });
    }
  });
  
  // Confirmer la fin de l'upload et lancer le traitement
  app.post('/complete', async (request, reply) => {
    const { fileId, storageKey } = request.body;
    const { db } = app;
    const auth = await verifyAuth(request, reply);
    if (!auth) return;
    
    try {
      // Vérifier que le fichier appartient bien à ce participant
      const fileResult = await db.query(
        `SELECT * FROM file_upload 
         WHERE id = $1 AND participant_id = $2 AND storage_key = $3`,
        [fileId, auth.participantId, storageKey]
      );
      
      if (fileResult.rows.length === 0) {
        return reply.code(404).send({ error: 'File not found' });
      }
      
      const file = fileResult.rows[0];
      
      // Lancer le traitement asynchrone
      processFileAsync(app, file);
      
      reply.send({ 
        status: 'processing',
        message: 'File processing started'
      });
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to complete upload' });
    }
  });
  
  // Route pour récupérer une preview supprimée - on utilise maintenant des URLs présignées directement dans /status
  
  // Route pour télécharger un fichier (après validation)
  app.get('/download/:fileId', async (request, reply) => {
    const { fileId } = request.params;
    const { token } = request.query;
    const { db } = app;
    
    if (!token) {
      return reply.code(401).send({ error: 'Download token required' });
    }
    
    try {
      // Vérifier le token de téléchargement
      const jwt = await import('jsonwebtoken');
      let decoded;
      
      try {
        decoded = jwt.default.verify(token, config.security.jwtSecret);
      } catch (error) {
        return reply.code(401).send({ error: 'Invalid or expired download token' });
      }
      
      // Vérifier que le fileId correspond
      if (decoded.fileId !== fileId) {
        return reply.code(403).send({ error: 'Invalid file access' });
      }
      
      // Vérifier que la session est bien en état 'released'
      const sessionResult = await db.query(
        `SELECT state FROM exchange_session WHERE id = $1`,
        [decoded.sessionId]
      );
      
      if (sessionResult.rows.length === 0 || sessionResult.rows[0].state !== 'released') {
        return reply.code(403).send({ error: 'Session not released' });
      }
      
      // Récupérer le fichier
      const fileResult = await db.query(
        `SELECT * FROM file_upload WHERE id = $1`,
        [fileId]
      );
      
      if (fileResult.rows.length === 0) {
        return reply.code(404).send({ error: 'File not found' });
      }
      
      const file = fileResult.rows[0];
      
      // Logger le téléchargement
      await db.query(
        `INSERT INTO download_log (file_id, participant_id, ip_address)
         VALUES ($1, $2, $3)`,
        [fileId, decoded.participantId || null, request.ip]
      );
      
      // Générer une URL signée pour le téléchargement avec le nom de fichier original
      const presignedUrl = await generatePresignedGetUrl(
        file.storage_key,
        600, // 10 minutes
        `attachment; filename="${file.original_name}"`
      );
      
      // Rediriger vers l'URL signée
      reply.redirect(presignedUrl);
      
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to download file' });
    }
  });
}

// Traitement asynchrone du fichier
async function processFileAsync(app, file) {
  const { db } = app;
  
  try {
    console.log(`Processing file ${file.id}...`);
    
    // 1. Télécharger le fichier depuis S3
    const getCommand = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: file.storage_key
    });
    
    const response = await s3Client.send(getCommand);
    const chunks = [];
    
    // Stream to buffer
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(`File downloaded, size: ${buffer.length} bytes`);
    
    // 2. Calculer le hash SHA-256
    const hash = createHash('sha256');
    hash.update(buffer);
    const sha256 = hash.digest('hex');
    
    console.log(`SHA-256: ${sha256}`);
    
    // 3. Vérifier le type MIME réel
    const fileType = await fileTypeFromBuffer(buffer);
    const realMimeType = fileType?.mime || file.mime_type;
    
    console.log(`MIME type: ${realMimeType}`);
    
    // 4. Scanner avec ClamAV
    await db.query(
      `UPDATE file_upload SET status = 'scanning' WHERE id = $1`,
      [file.id]
    );
    
    const scanResult = await scanFile(buffer);
    
    if (!scanResult.clean) {
      await db.query(
        `UPDATE file_upload 
         SET status = 'blocked', 
             scan_result = $2,
             scanned_at = NOW()
         WHERE id = $1`,
        [file.id, JSON.stringify(scanResult)]
      );
      
      // Notifier via WebSocket
      notifySession(app, file.session_id, 'file_blocked', {
        fileId: file.id,
        reason: scanResult.virus || 'Malware detected'
      });
      
      return;
    }
    
    // 5. Générer la preview
    let previewKey = null;
    let previewMetadata = {};
    
    try {
      console.log(`Generating preview for ${realMimeType}...`);
      const preview = await generatePreview(buffer, realMimeType, file.filename);
      
      if (preview) {
        previewKey = `previews/${file.session_id}/${file.id}_preview.${preview.extension}`;
        
        console.log(`Uploading preview to S3: ${previewKey}`);
        
        // Upload la preview sur S3
        await s3Client.send(new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: previewKey,
          Body: preview.buffer,
          ContentType: preview.mimeType,
          Metadata: {
            'original-file-id': file.id
          }
        }));
        
        previewMetadata = preview.metadata || {};
        console.log(`Preview uploaded successfully`);
      } else {
        console.log(`No preview generated for this file type`);
      }
    } catch (previewError) {
      console.warn(`Failed to generate preview for file ${file.id}:`, previewError);
      // La preview est optionnelle, on continue
    }
    
    // 6. Mettre à jour le fichier comme prêt
    await db.query(
      `UPDATE file_upload 
       SET status = 'ready',
           sha256_hash = $2,
           mime_type = $3,
           preview_key = $4,
           preview_metadata = $5,
           scanned_at = NOW(),
           scan_result = $6
       WHERE id = $1`,
      [
        file.id, 
        sha256, 
        realMimeType, 
        previewKey,
        JSON.stringify(previewMetadata),
        JSON.stringify(scanResult)
      ]
    );
    
    console.log(`File ${file.id} marked as ready`);
    
    // 7. Vérifier si la session peut passer à 'ready'
    const sessionCheck = await db.query(
      `SELECT check_session_ready($1) as is_ready`,
      [file.session_id]
    );
    
    if (sessionCheck.rows[0].is_ready) {
      await db.query(
        `UPDATE exchange_session 
         SET state = 'ready' 
         WHERE id = $1 AND state = 'created'`,
        [file.session_id]
      );
      
      // Notifier tous les participants
      notifySession(app, file.session_id, 'session_ready');
      console.log(`Session ${file.session_id} is now ready`);
    }
    
    // Notifier que le fichier est prêt
    notifySession(app, file.session_id, 'file_ready', {
      participantRole: file.participant_id
    });
    
  } catch (error) {
    console.error(`Failed to process file ${file.id}:`, error);
    
    await db.query(
      `UPDATE file_upload 
       SET status = 'blocked',
           scan_result = $2
       WHERE id = $1`,
      [file.id, JSON.stringify({ error: error.message })]
    );
    
    notifySession(app, file.session_id, 'file_error', {
      fileId: file.id,
      error: 'File processing failed'
    });
  }
}

// Helper pour les notifications WebSocket
function notifySession(app, sessionId, type, data = {}) {
  if (app.websocketServer && app.websocketServer.clients) {
    app.websocketServer.clients.forEach(client => {
      if (client.sessionId === sessionId && client.readyState === 1) {
        client.send(JSON.stringify({ type, ...data }));
      }
    });
  }
}
