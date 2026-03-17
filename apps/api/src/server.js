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

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  process.env.WEB_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) return cb(null, true);
    cb(null, true); // permissive in production; tighten if needed
  },
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/extract', extractRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/chunks', chunksRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/graph', graphRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
