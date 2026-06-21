import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Establish database pool connecting to local postgres instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://mailpilot_user@localhost/mailpilot_db"
});

export const query = (text, params) => pool.query(text, params);

export default pool;
