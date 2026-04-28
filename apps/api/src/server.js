require('dotenv').config();

const express = require('express');
const cors = require('cors');

const uploadRoutes = require('./routes/upload.routes');
const extractRoutes = require('./routes/extract.routes');
const filesRoutes = require('./routes/files.routes');
const authRoutes = require('./routes/auth.routes');
const casesRoutes = require('./routes/cases.routes');
const chunksRoutes = require('./routes/chunks.routes');
const entitiesRoutes = require('./routes/entities.routes');
const graphRoutes = require('./routes/graph.routes');
const classifyRoutes = require('./routes/classify.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
const factcheckRoutes = require('./routes/factcheck.routes');
const processRoutes = require('./routes/process.routes');

const app = express();

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  process.env.WEB_URL,
  'https://doc-intell-app-web.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    if (allowedOrigins.some((o) => origin === o || origin.startsWith(o))) {
      return cb(null, true);
    }

    if (!isProd) return cb(null, true);

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'doc-intell-app',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/extract', extractRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/chunks', chunksRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/classify', classifyRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/fact-check', factcheckRoutes);
app.use('/api/process', processRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: isProd ? undefined : err.message,
  });
});

app.listen(PORT, HOST, () => {
  console.log(`API server running on http://${HOST}:${PORT}`);
});