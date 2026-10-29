import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('webhook_events', (t) => {
    // event_id as PRIMARY KEY is what makes duplicate delivery safe.
    t.text('event_id').primary();
    t.text('message_id').notNullable().references('id').inTable('messages');
    t.text('status').notNullable();
    t.timestamp('occurred_at', { useTz: true }).notNullable();
    t.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.text('processing_state').notNullable().defaultTo('PENDING');
    t.text('outcome');
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('processed_at', { useTz: true });
    t.index(['message_id'], 'idx_webhook_events_message');
    t.index(['processing_state'], 'idx_webhook_events_state');
  });
  await knex.raw(
    `ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_state_check
     CHECK (processing_state IN ('PENDING','APPLIED','IGNORED','FAILED'))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_events');
}
