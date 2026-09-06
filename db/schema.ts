import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const circles=sqliteTable('circles',{
 id:text('id').primaryKey(),
 adminHash:text('admin_hash').notNull(),
 shareHash:text('share_hash').notNull(),
 payload:text('payload').notNull(),
 revision:integer('revision').notNull().default(0),
 createdAt:text('created_at').notNull()
});
