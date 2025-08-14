import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

export async function setupDatabase() {
  const pool = new Pool({
    connectionString: config.db.connectionString
  });
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
  
  return {
    query: (text, params) => pool.query(text, params),
    
    transaction: async (callback) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    
    pool: pool
  };
}
