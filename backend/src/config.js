import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger le .env depuis le dossier parent
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export default {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  
  db: {
    connectionString: process.env.DATABASE_URL
  },
  
  redis: {
    url: process.env.REDIS_URL
  },
  
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    },
    bucket: process.env.S3_BUCKET,
    forcePathStyle: true // Pour MinIO
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET,
    sessionExpiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS || '48'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240')
  },
  
  clamav: {
    host: process.env.CLAMAV_HOST,
    port: parseInt(process.env.CLAMAV_PORT || '3310')
  }
};
