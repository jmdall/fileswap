// Test routes for debugging preview functionality
import config from '../config.js';

export default async function testRoutes(app) {
  // Test route to get info about files with previews
  app.get('/test/preview-info', async (request, reply) => {
    const { db } = app;
    
    // Get the most recent files with previews
    const result = await db.query(
      `SELECT 
        f.id,
        f.filename,
        f.mime_type,
        f.status,
        f.preview_key,
        f.sha256_hash,
        s.id as session_id,
        s.state as session_state
       FROM file_upload f
       JOIN exchange_session s ON s.id = f.session_id
       WHERE f.status = 'ready'
       ORDER BY f.uploaded_at DESC
       LIMIT 5`
    );
    
    const files = result.rows.map(file => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mime_type,
      status: file.status,
      hasPreview: !!file.preview_key,
      previewKey: file.preview_key,
      sessionId: file.session_id,
      sessionState: file.session_state,
      previewUrl: file.preview_key ? `/api/uploads/preview/${file.id}` : null,
      testDirectUrl: file.preview_key ? `/api/test/preview-direct/${file.id}` : null
    }));
    
    reply.send({
      message: 'Files with ready status',
      count: files.length,
      files
    });
  });
  
  // Direct preview test without auth (for debugging only)
  app.get('/test/preview-direct/:fileId', async (request, reply) => {
    const { fileId } = request.params;
    const { db } = app;
    
    console.log(`[Test] Direct preview request for file: ${fileId}`);
    
    const result = await db.query(
      `SELECT preview_key, filename FROM file_upload WHERE id = $1`,
      [fileId]
    );
    
    if (result.rows.length === 0) {
      console.log(`[Test] File not found: ${fileId}`);
      return reply.code(404).send({ error: 'File not found' });
    }
    
    if (!result.rows[0].preview_key) {
      console.log(`[Test] No preview for file: ${fileId}`);
      return reply.code(404).send({ error: 'Preview not found' });
    }
    
    console.log(`[Test] Preview key: ${result.rows[0].preview_key}`);
    
    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3Client = new S3Client(config.s3);
      
      const command = new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: result.rows[0].preview_key
      });
      
      const presignedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 300
      });
      
      console.log(`[Test] Generated presigned URL for preview`);
      
      // Instead of redirect, send the URL so we can debug
      reply.send({
        fileId,
        filename: result.rows[0].filename,
        previewKey: result.rows[0].preview_key,
        presignedUrl,
        message: 'Open presignedUrl in browser to see the preview'
      });
      
    } catch (error) {
      console.error(`[Test] Error generating preview URL:`, error);
      reply.code(500).send({ error: 'Failed to generate preview URL' });
    }
  });
  
  // Test MinIO connectivity
  app.get('/test/minio', async (request, reply) => {
    try {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client(config.s3);
      
      const command = new ListObjectsV2Command({
        Bucket: config.s3.bucket,
        Prefix: 'previews/',
        MaxKeys: 10
      });
      
      const response = await s3Client.send(command);
      
      reply.send({
        message: 'MinIO connection successful',
        bucket: config.s3.bucket,
        previewCount: response.KeyCount || 0,
        previews: response.Contents?.map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified
        })) || []
      });
    } catch (error) {
      console.error('[Test] MinIO error:', error);
      reply.code(500).send({ 
        error: 'MinIO connection failed',
        details: error.message 
      });
    }
  });
}
