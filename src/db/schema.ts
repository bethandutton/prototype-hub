import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Where a team keeps its prototype files. Only GitHub works today; the
// other two are shown as "coming soon" in the storage picker.
export const storageKinds = ["github", "google-drive", "rehearsal-cloud"] as const;
export type StorageKind = (typeof storageKinds)[number];

// One GitHub connection per organisation, made by whoever connected it.
export const githubConnections = pgTable("github_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().unique(),
  connectedBy: text("connected_by").notNull(),
  login: text("login").notNull(),
  tokenCiphertext: text("token_ciphertext").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A project is a folder of prototype files in the team's own storage.
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  storage: text("storage").$type<StorageKind>().notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  branch: text("branch").notNull(),
  // Folder inside the repository, without leading or trailing slashes. Empty means the root.
  path: text("path").notNull().default(""),
  entryFile: text("entry_file").notNull().default("index.html"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type GithubConnection = typeof githubConnections.$inferSelect;
