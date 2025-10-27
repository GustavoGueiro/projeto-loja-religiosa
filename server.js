// server.js (CommonJS) — Express + json-server
const express = require('express');
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

const app = express();
const router = jsonServer.router(path.join(__dirname, 'db.json'));

// 1) CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 2) Estáticos (HTML, CSS, JS, imagens) servidos da raiz do projeto
app.use(express.static(__dirname, {
  extensions: ['html', 'htm', 'js', 'css', 'png', 'jpg', 'jpeg', 'webp', 'svg']
}));

// 3) json-server defaults (somente logger; estáticos já são do Express)
app.use(jsonServer.defaults({ logger: true }));

// 4) Rewriter opcional (se json-server.json existir)
const routesPath = path.join(__dirname, 'json-server.json');
if (fs.existsSync(routesPath)) {
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
  app.use(jsonServer.rewriter(routes));
}

// 5) Rota raiz (garante servir o index.html)
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 6) API (cria /produtos, /produtos/:id, etc.)
app.use(router);

// 7) Sobe o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://127.0.0.1:${PORT}`);
  console.log('📦 Estáticos: /assets/*  |  🔌 API: /produtos');
});
