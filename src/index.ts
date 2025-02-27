import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import axios from "axios";
import express from "express";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "<your-anthropic-api-key>";

const server = new Server(
  { name: "mcp-claude-demo", version: "1.0.0" },
  { capabilities: { resources: {} } }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "file:///app/src/izahname.txt",
        name: "Izahname Document",
        description: "Kullanıcı dokümanı",
        mimeType: "text/plain",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "file:///app/src/izahname.txt") {
    const content = await fs.readFile("src/izahname.txt", "utf-8");
    return { contents: [{ uri: request.params.uri, text: content }] };
  }
  throw new Error("Resource not found");
});

const app = express();
app.use(express.json());

app.post("/ask", async (req, res) => {
  const question = req.body.question;
  try {
    const content = await fs.readFile("src/izahname.txt", "utf-8");
    const prompt = `Doküman: ${content}\nSoru: ${question}\nCevap:`;
    const response = await axios.post(
      "https://api.anthropic.com/v1/complete",
      {
        prompt: prompt,
        model: "claude-3-sonnet-20240229",
        max_tokens_to_sample: 300,
      },
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    res.json({ answer: response.data.completion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP sunucusu ${PORT} portunda çalışıyor`));

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.info('{"jsonrpc": "2.0", "method": "log", "params": { "message": "Server running..." }}');
})(); 
