import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

// One Google Drive connection per organisation. The refresh token lets
// Rehearsal read and write the folders a project points at.
export const driveConnections = pgTable("drive_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().unique(),
  connectedBy: text("connected_by").notNull(),
  email: text("email").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A project is a folder of prototype files in the team's own storage:
// a GitHub repository (repoOwner/repoName/branch/path) or a Drive folder.
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  storage: text("storage").$type<StorageKind>().notNull(),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  branch: text("branch"),
  // Folder inside the repository, without leading or trailing slashes. Empty means the root.
  path: text("path").notNull().default(""),
  driveFolderId: text("drive_folder_id"),
  entryFile: text("entry_file").notNull().default("index.html"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A token a person creates so their own agent can act in their team over
// MCP. Only a hash is kept; the token itself is shown once.
export const agentTokens = pgTable("agent_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A comment is pinned to one element of the prototype, identified by a CSS
// path the frame helper can find again. It remembers which version it was
// written against, so older remarks still make sense after changes.
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  element: text("element").notNull(),
  elementLabel: text("element_label").notNull(),
  version: text("version").notNull(),
  body: text("body").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Plans don't limit anything yet; they are recorded so the admin area and
// later billing have something to work from.
export const plans = ["free", "pro", "enterprise"] as const;
export type Plan = (typeof plans)[number];

export const orgSettings = pgTable("org_settings", {
  orgId: text("org_id").primaryKey(),
  plan: text("plan").$type<Plan>().notNull().default("free"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Drive has no commits, so each publish (or change noticed in the folder)
// is recorded here with the revision of every file at that moment.
export type DriveVersionFile = { path: string; fileId: string; revisionId: string; size: number };

export const driveVersions = pgTable("drive_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  author: text("author").notNull(),
  files: jsonb("files").$type<DriveVersionFile[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type AgentToken = typeof agentTokens.$inferSelect;
export type GithubConnection = typeof githubConnections.$inferSelect;
