import mysql from 'mysql2/promise';
import { ensureCommunitySchema } from './community.mjs';

const database = mysql.createPool({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'smart_education',
  waitForConnections: true,
  connectionLimit: 2,
  queueLimit: 0,
});

try {
  await ensureCommunitySchema(database);
  console.log('Community MySQL tables are ready.');
} catch (error) {
  console.error('Community MySQL migration failed. Check that MySQL is running and the configured database user can create tables.', error?.code ?? 'unknown error');
  process.exitCode = 1;
} finally {
  await database.end();
}
