import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const study = sqliteTable("study", {
  owner: text("owner").primaryKey(),
  value: text("value").notNull(),
  revision: integer("revision").notNull().default(0),
});
export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
});
