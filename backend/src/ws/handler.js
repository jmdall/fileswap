import jwt from 'jsonwebtoken';
import config from '../config.js';

export default async function wsHandler(app) {
  app.get('/', { websocket: true }, (connection, request) => {
    const { socket } = connection;
    
    // Authentification
    const token = request.query.token || request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      socket.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      socket.close();
      return;
    }
    
    try {
      const decoded = jwt.verify(token, config.security.jwtSecret);
      socket.participantId = decoded.participantId;
      socket.sessionId = decoded.sessionId;
      socket.role = decoded.role;
      
      // Stocker la connexion
      if (!app.websocketServer) {
        app.websocketServer = { clients: new Set() };
      }
      app.websocketServer.clients.add(socket);
      
      // Envoyer la confirmation
      socket.send(JSON.stringify({ 
        type: 'connected',
        sessionId: decoded.sessionId,
        role: decoded.role
      }));
      
      // Gérer les messages
      socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await handleMessage(app, socket, data);
        } catch (error) {
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      });
      
      // Gérer la déconnexion
      socket.on('close', () => {
        if (app.websocketServer && app.websocketServer.clients) {
          app.websocketServer.clients.delete(socket);
        }
      });
      
    } catch (error) {
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid token' 
      }));
      socket.close();
    }
  });
}

async function handleMessage(app, socket, data) {
  const { db } = app;
  
  switch (data.type) {
    case 'ping':
      socket.send(JSON.stringify({ type: 'pong' }));
      break;
      
    case 'status':
      // Envoyer le statut actuel
      const status = await getSessionStatus(db, socket.sessionId, socket.participantId);
      socket.send(JSON.stringify({ type: 'status', data: status }));
      break;
      
    default:
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: `Unknown message type: ${data.type}` 
      }));
  }
}

async function getSessionStatus(db, sessionId, participantId) {
  // Récupérer le statut de la session
  try {
    const result = await db.query(
      `SELECT 
        s.state,
        s.expires_at,
        (SELECT COUNT(*) FROM participant WHERE session_id = s.id AND accepted_at IS NOT NULL) as accepted_count,
        (SELECT COUNT(*) FROM file_upload WHERE session_id = s.id AND status = 'ready') as ready_count
       FROM exchange_session s
       WHERE s.id = $1`,
      [sessionId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting session status:', error);
    return null;
  }
}
