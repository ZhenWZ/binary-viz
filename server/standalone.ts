import express from "express";
import { createServer } from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // In standalone mode, static files are always in ./public relative to this script
  const staticPath = path.resolve(__dirname, "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Binary Data Visualizer running at http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
