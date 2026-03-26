const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const POSTS_FILE = path.join(__dirname, 'posts.json');

if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2));
}

function lerPosts() {
  return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
}

function salvarPosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// API para pegar todos os posts
app.get('/api/posts', (req, res) => {
  const posts = lerPosts();
  posts.sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(posts);
});

// API para pegar um post específico
app.get('/api/posts/:slug', (req, res) => {
  const posts = lerPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  
  if (!post) {
    return res.status(404).json({ error: 'Post não encontrado' });
  }
  
  // Incrementar visualizações
  post.visualizacoes = (post.visualizacoes || 0) + 1;
  salvarPosts(posts);
  
  res.json(post);
});

// API para pegar posts por categoria
app.get('/api/category/:nome', (req, res) => {
  const posts = lerPosts();
  const filtrados = posts.filter(p => p.categoria === req.params.nome);
  filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(filtrados);
});

// API para buscar posts
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  
  const posts = lerPosts();
  const results = posts.filter(p => 
    p.titulo.toLowerCase().includes(q.toLowerCase()) ||
    p.resumo.toLowerCase().includes(q.toLowerCase()) ||
    p.categoria.toLowerCase().includes(q.toLowerCase()) ||
    p.conteudo.toLowerCase().includes(q.toLowerCase())
  );
  results.sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(results);
});

// API para pegar posts populares
app.get('/api/popular', (req, res) => {
  const posts = lerPosts();
  const populares = [...posts].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5);
  res.json(populares);
});

// API para pegar categorias
app.get('/api/categories', (req, res) => {
  const posts = lerPosts();
  const categorias = [...new Set(posts.map(p => p.categoria))];
  res.json(categorias);
});

// Servir arquivos HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/post/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'post.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get('/category/:nome', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'category.html'));
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(3000, () => console.log('🚀 Servidor em http://localhost:3000'));
}