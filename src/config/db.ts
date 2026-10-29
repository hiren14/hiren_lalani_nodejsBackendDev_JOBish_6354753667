import knex from 'knex';
import knexConfig from '../../knexfile';

// Single shared pool. Connections are opened lazily on first query.
export const db = knex(knexConfig);
