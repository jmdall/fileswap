import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config.js';

const s3Client = new S3Client(config.s3);

// Helper pour générer une URL présignée pour un objet S3
async function generatePresignedGetUrl(key, expiresIn = 300) {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export default async function sessionRoutes(app) {
  // Créer une nouvelle session
  app.post('/', async (request, reply) => {
    const { db } = app;
    
    try {
      const result = await db.transaction(async (client) => {
        // Créer la session
        const sessionResult = await client.query(
          `INSERT INTO exchange_session DEFAULT VALUES RETURNING *`
        );
        const session = sessionResult.rows[0];
        
        // Créer les deux participants
        const tokenA = nanoid(32);
        const tokenB = nanoid(32);
        
        await client.query(
          `INSERT INTO participant (session_id, role, token) VALUES ($1, 'A', $2)`,
          [session.id, tokenA]
        );
        
        await client.query(
          `INSERT INTO participant (session_id, role, token) VALUES ($1, 'B', $2)`,
          [session.id, tokenB]
        );
        
        return {
          sessionId: session.id,
          expiresAt: session.expires_at,
          invites: {
            A: {
              url: `/join?sid=${session.id}&token=${tokenA}`,
              token: tokenA
            },
            B: {
              url: `/join?sid=${session.id}&token=${tokenB}`,
              token: tokenB
            }
          }
        };
      });
      
      reply.code(201).send(result);
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to create session' });
    }
  });
  
  // Rejoindre une session
  app.post('/:sessionId/join', async (request, reply) => {
    const { sessionId } = request.params;
    const { token } = request.body;
    const { db } = app;
    
    if (!token) {
      return reply.code(400).send({ error: 'Token is required' });
    }
    
    try {
      // Vérifier le token et récupérer le participant
      const result = await db.query(
        `SELECT p.*, s.state, s.expires_at 
         FROM participant p
         JOIN exchange_session s ON s.id = p.session_id
         WHERE p.token = $1 AND p.session_id = $2`,
        [token, sessionId]
      );
      
      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid token or session' });
      }
      
      const participant = result.rows[0];
      
      // Vérifier que la session n'est pas expirée
      if (new Date(participant.expires_at) < new Date()) {
        return reply.code(410).send({ error: 'Session expired' });
      }
      
      // Mettre à jour les infos de connexion
      await db.query(
        `UPDATE participant 
         SET joined_at = NOW(), ip_address = $1, user_agent = $2 
         WHERE id = $3`,
        [request.ip, request.headers['user-agent'], participant.id]
      );
      
      // Générer un JWT pour les futures requêtes
      const jwt_token = jwt.sign(
        {
          participantId: participant.id,
          sessionId: participant.session_id,
          role: participant.role
        },
        config.security.jwtSecret,
        { expiresIn: '48h' }
      );
      
      reply.send({
        token: jwt_token,
        sessionId: participant.session_id,
        role: participant.role,
        state: participant.state,
        expiresAt: participant.expires_at
      });
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to join session' });
    }
  });
  
  // Obtenir le statut de la session
  app.get('/:sessionId/status', async (request, reply) => {
    const { sessionId } = request.params;
    const { db } = app;
    const auth = await verifyAuth(request, reply);
    if (!auth) return;
    
    try {
      // Récupérer l'état de la session
      const sessionResult = await db.query(
        `SELECT * FROM exchange_session WHERE id = $1`,
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      
      const session = sessionResult.rows[0];
      
      // Récupérer mon fichier
      const myFileResult = await db.query(
        `SELECT * FROM file_upload 
         WHERE session_id = $1 AND participant_id = $2`,
        [sessionId, auth.participantId]
      );
      
      // Récupérer le fichier de l'autre participant
      const peerFileResult = await db.query(
        `SELECT f.*, p.role 
         FROM file_upload f
         JOIN participant p ON p.id = f.participant_id
         WHERE f.session_id = $1 AND f.participant_id != $2`,
        [sessionId, auth.participantId]
      );
      
      // Récupérer les statuts d'acceptation
      const participantsResult = await db.query(
        `SELECT role, accepted_at IS NOT NULL as accepted
         FROM participant
         WHERE session_id = $1`,
        [sessionId]
      );
      
      const participants = {};
      participantsResult.rows.forEach(p => {
        participants[p.role] = { accepted: p.accepted };
      });
      
      // Si il y a un fichier peer avec preview, générer l'URL présignée directement
      let peerPreviewUrl = null;
      if (peerFileResult.rows[0] && peerFileResult.rows[0].preview_key) {
        try {
          // Utiliser notre fonction helper pour générer l'URL présignée
          peerPreviewUrl = await generatePresignedGetUrl(peerFileResult.rows[0].preview_key, 300);
          console.log(`[Status] Generated presigned preview URL for file ${peerFileResult.rows[0].id}`);
        } catch (error) {
          console.error('[Status] Failed to generate preview URL:', error);
        }
      }
      
      // Construire la réponse avec l'URL présignée directe
      const response = {
        session: {
          id: session.id,
          state: session.state,
          expiresAt: session.expires_at
        },
        me: {
          role: auth.role,
          file: myFileResult.rows[0] ? {
            id: myFileResult.rows[0].id,
            filename: myFileResult.rows[0].filename,
            size: myFileResult.rows[0].size_bytes,
            status: myFileResult.rows[0].status,
            uploadedAt: myFileResult.rows[0].uploaded_at
          } : null,
          accepted: participants[auth.role]?.accepted || false
        },
        peer: {
          file: peerFileResult.rows[0] ? {
            id: peerFileResult.rows[0].id,
            filename: peerFileResult.rows[0].filename,
            size: peerFileResult.rows[0].size_bytes,
            mimeType: peerFileResult.rows[0].mime_type,
            sha256: peerFileResult.rows[0].sha256_hash,
            // Utiliser directement l'URL présignée S3
            previewUrl: peerPreviewUrl,
            status: peerFileResult.rows[0].status
          } : null,
          accepted: participants[auth.role === 'A' ? 'B' : 'A']?.accepted || false
        }
      };

      // Si la session est released, ajouter les URLs de téléchargement
      if (session.state === 'released') {
        const downloadUrls = {};
        
        // Générer token de download pour mon fichier
        if (myFileResult.rows[0]) {
          const downloadToken = jwt.sign(
            {
              fileId: myFileResult.rows[0].id,
              sessionId: sessionId,
              participantId: auth.participantId,
              exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes
            },
            config.security.jwtSecret
          );
          downloadUrls[auth.role] = `/api/uploads/download/${myFileResult.rows[0].id}?token=${downloadToken}`;
        }
        
        // Générer token de download pour le fichier peer
        if (peerFileResult.rows[0]) {
          const downloadToken = jwt.sign(
            {
              fileId: peerFileResult.rows[0].id,
              sessionId: sessionId,
              participantId: auth.participantId,
              exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes
            },
            config.security.jwtSecret
          );
          downloadUrls[peerFileResult.rows[0].role] = `/api/uploads/download/${peerFileResult.rows[0].id}?token=${downloadToken}`;
        }
        
        response.downloadUrls = downloadUrls;
      }
      
      reply.send(response);
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to get session status' });
    }
  });
  
  // Accepter l'échange
  app.post('/:sessionId/accept', async (request, reply) => {
    const { sessionId } = request.params;
    const { db, redis } = app;
    const auth = await verifyAuth(request, reply);
    if (!auth) return;
    
    try {
      // Acquérir un lock pour éviter les conditions de course
      const lock = await redis.acquireLock(`session:${sessionId}:accept`, 5000);
      if (!lock) {
        return reply.code(503).send({ error: 'Another operation in progress' });
      }
      
      try {
        const result = await db.transaction(async (client) => {
          // Marquer l'acceptation
          await client.query(
            `UPDATE participant 
             SET accepted_at = NOW() 
             WHERE id = $1 AND accepted_at IS NULL`,
            [auth.participantId]
          );
          
          // Vérifier si les deux ont accepté
          const checkResult = await client.query(
            `SELECT COUNT(*) as accepted_count 
             FROM participant 
             WHERE session_id = $1 AND accepted_at IS NOT NULL`,
            [sessionId]
          );
          
          const acceptedCount = parseInt(checkResult.rows[0].accepted_count);
          
          if (acceptedCount === 2) {
            // Vérifier que la session est prête
            const sessionResult = await client.query(
              `SELECT state FROM exchange_session WHERE id = $1`,
              [sessionId]
            );
            
            if (sessionResult.rows[0].state === 'ready') {
              // Passer à l'état released
              await client.query(
                `UPDATE exchange_session 
                 SET state = 'released' 
                 WHERE id = $1`,
                [sessionId]
              );
              
              // Générer les URLs de téléchargement
              const filesResult = await client.query(
                `SELECT f.*, p.role 
                 FROM file_upload f
                 JOIN participant p ON p.id = f.participant_id
                 WHERE f.session_id = $1`,
                [sessionId]
              );
              
              const downloadUrls = {};
              for (const file of filesResult.rows) {
                const downloadToken = jwt.sign(
                  {
                    fileId: file.id,
                    sessionId: sessionId,
                    participantId: auth.participantId,
                    exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes
                  },
                  config.security.jwtSecret
                );
                
                downloadUrls[file.role] = `/api/uploads/download/${file.id}?token=${downloadToken}`;
              }
              
              // Notifier via WebSocket (si implémenté)
              if (app.websocketServer && app.websocketServer.clients) {
                app.websocketServer.clients.forEach(client => {
                  if (client.sessionId === sessionId && client.readyState === 1) {
                    client.send(JSON.stringify({
                      type: 'released',
                      downloadUrls
                    }));
                  }
                });
              }
              
              return {
                state: 'released',
                downloadUrls
              };
            }
          }
          
          return {
            state: 'accepted',
            acceptedCount
          };
        });
        
        reply.send(result);
      } finally {
        await lock.release();
      }
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to accept exchange' });
    }
  });
  
  // Refuser l'échange
  app.post('/:sessionId/reject', async (request, reply) => {
    const { sessionId } = request.params;
    const { db } = app;
    const auth = await verifyAuth(request, reply);
    if (!auth) return;
    
    try {
      await db.query(
        `UPDATE exchange_session 
         SET state = 'cancelled' 
         WHERE id = $1 AND state NOT IN ('released', 'cancelled', 'expired')`,
        [sessionId]
      );
      
      // Notifier via WebSocket
      if (app.websocketServer && app.websocketServer.clients) {
        app.websocketServer.clients.forEach(client => {
          if (client.sessionId === sessionId && client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'cancelled'
            }));
          }
        });
      }
      
      reply.send({ state: 'cancelled' });
    } catch (error) {
      app.log.error(error);
      reply.code(500).send({ error: 'Failed to reject exchange' });
    }
  });
}

// Helper pour vérifier l'authentification
export async function verifyAuth(request, reply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    reply.code(401).send({ error: 'Missing authentication token' });
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret);
    return decoded;
  } catch (error) {
    reply.code(401).send({ error: 'Invalid authentication token' });
    return null;
  }
}
