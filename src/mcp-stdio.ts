import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase, seed } from './db.js';
import { createMcpServer } from './mcp.js';

const db=openDatabase();seed(db);const server=createMcpServer(db);await server.connect(new StdioServerTransport());
