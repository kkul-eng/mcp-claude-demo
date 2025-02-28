import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import express, { Request, Response } from "express";  // Türleri ekledik
import axios from "axios";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:5000/ask";  // Render’da bulut IP’sine ayarlanacak

const server = new Server(
  { name: "mcp-mistral-web-ollama", version: "1.0.0" },
  { capabilities: { resources: {} } }
);

// Kaynakları listele
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "file:///app/src/izahname.txt",
        name: "Izahname Document",
        description: "Web üzerinden soru-cevap için doküman (Ollama ile)",
        mimeType: "text/plain",
      },
    ],
  };
});

// Kaynak içeriğini oku
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "file:///app/src/izahname.txt") {
    const content = await fs.readFile("src/izahname.txt", "utf-8");
    return { contents: [{ uri: request.params.uri, text: content }] };
  }
  throw new Error("Resource not found");
});

// HTTP Sunucusu
const app = express();
app.use(express.json());

// Soru-cevap endpoint’i (Ollama üzerinden)
app.post("/ask", async (req: Request, res: Response) => {
  const question = req.body.question;
  try {
    const content = await fs.readFile("src/izahname.txt", "utf-8");
    const response = await axios.post(
      OLLAMA_API_URL,
      { question },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,  // 10 saniye timeout
      }
    );

    if (!response.data || !response.data.answer) {
      throw new Error("API yanıtında beklenen formatta veri yok");
    }

    const answer = response.data.answer;
    res.json({ answer });
  } catch (error: any) {
    console.error("Hata detayları:", error.message);
    let errorMessage = "Cevap alınamadı";
    if (error.response) {
      errorMessage += `: API hatası - ${error.response.status} (${error.response.statusText})`;
    } else if (error.request) {
      errorMessage += `: İstek gönderilemedi - ${error.message}`;
    } else {
      errorMessage += `: ${error.message}`;
    }
    res.status(500).json({ error: errorMessage });
  }
});

// Web sayfasını serve et
app.get("/", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Izahname Dokümanına Soru-Cevap</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        textarea, button { width: 100%; margin: 10px 0; padding: 10px; }
        #answer { margin-top: 20px; padding: 10px; border: 1px solid #ccc; }
      </style>
    </head>
    <body>
      <h1>Izahname Dokümanına Soru Sor</h1>
      <textarea id="question" placeholder="Sorunuzu buraya yazın..."></textarea>
      <button onclick="ask()">Soruyu Gönder</button>
      <div id="answer"></div>
      <script>
        async function ask() {
          const question = document.getElementById("question").value;
          const response = await fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question }),
          });
          const data = await response.json();
          document.getElementById("answer").innerText = data.answer || "Cevap alınamadı.";
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP sunucusu ${PORT} portunda çalışıyor`));

// MCP Sunucusu
(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.info('{"jsonrpc": "2.0", "method": "log", "params": { "message": "Server running..." }}');
})();
