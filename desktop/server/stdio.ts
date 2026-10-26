import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { Store } from "../core/store";
import { createMcpServer } from "./mcp";

// Entry point for agents that launch the server themselves, for example
// `claude mcp add rehearsal -- node /path/to/stdio.cjs`. It reads and writes
// the same workspace folders as the app, so the app picks changes up live.
const store = new Store();
serveStdio(() => createMcpServer(store));
