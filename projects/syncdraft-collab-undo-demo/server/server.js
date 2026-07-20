import { Server } from "@hocuspocus/server";

const server = new Server({
  port: 1234,
  // Later: onAuthenticate, onLoadDocument, persistence, etc.
});

server.listen();

console.log("🚀 Hocuspocus server running at ws://localhost:1234");