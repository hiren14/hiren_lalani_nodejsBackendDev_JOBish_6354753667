import 'dotenv/config';
import path from 'path';
import type { Knex } from 'knex';

// Works both with ts-node (migrations/*.ts) and compiled output (dist/migrations/*.js).
const ext = path.extname(__filename);

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: ext.slice(1),
    loadExtensions: [ext],
  },
};

export = config;
