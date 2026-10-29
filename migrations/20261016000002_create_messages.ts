import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (t) => {
    t.text('id').primary();
    // Monotonic insertion order: used as the stable pagination cursor.
    t.specificType('seq', 'bigserial').notNullable().unique();
    t.text('tenant_id').notNullable();
    t.text('conversation_id').notNullable();
    t.text('recipient').notNullable();
    t.text('text').notNullable();
    t.text('status').notNullable().defaultTo('QUEUED');
    t.timestamp('sent_at', { useTz: true });
    t.timestamp('delivered_at', { useTz: true });
    t.timestamp('read_at', { useTz: true });
    t.timestamp('failed_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'conversation_id', 'seq'], 'idx_messages_conversation_seq');
  });
  await knex.raw(
    `ALTER TABLE messages ADD CONSTRAINT messages_status_check
     CHECK (status IN ('QUEUED','SENT','DELIVERED','READ','FAILED'))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
}
