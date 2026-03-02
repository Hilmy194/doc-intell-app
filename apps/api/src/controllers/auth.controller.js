// Auth controller — simple JWT login
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

// Default credentials — override via AUTH_EMAIL / AUTH_PASSWORD env vars
const AUTH_EMAIL = process.env.AUTH_EMAIL || 'admin@docintel.com';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';

const handleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate credentials
    if (email !== AUTH_EMAIL || password !== AUTH_PASSWORD) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = {
      id: 'usr_admin_001',
      email: AUTH_EMAIL,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { handleLogin };
