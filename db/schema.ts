import {sqliteTable,text,integer,real,index} from 'drizzle-orm/sqlite-core';
export const scenarios=sqliteTable('scenarios',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),name:text('name').notNull(),team:text('team').notNull(),
 decisions:text('decisions_json').notNull(),version:text('version').notNull(),score:real('score').notNull(),cost:integer('cost').notNull(),
 shareId:text('share_id').unique(),published:integer('published').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_scenarios_owner_updated').on(t.ownerId,t.updatedAt),index('idx_scenarios_published_score').on(t.published,t.score)]);
export const analyses=sqliteTable('analyses',{id:text('id').primaryKey(),response:text('response_json').notNull(),createdAt:text('created_at').notNull()});
export const usage=sqliteTable('usage',{id:text('id').primaryKey(),count:integer('count').notNull().default(0)});
