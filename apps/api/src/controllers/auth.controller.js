// Auth controller — Supabase Auth based login & register
const jwt = require('jsonwebtoken');
const supabase = require('../services/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

/**
 * POST /api/auth/login
 * Authenticate user via Supabase Auth and return a JWT.
 */
const handleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || '',
    };

    // Issue our own JWT so the rest of the API stays consistent
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

/**
 * POST /api/auth/register
 * Create a new user via Supabase Auth.
 */
const handleRegister = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || '' },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // If email confirmation is disabled in Supabase, the user is immediately valid.
    // If enabled, data.user.identities will be empty for duplicate emails.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || '',
    };

    // Auto-login: issue token right away
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user,
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

module.exports = { handleLogin, handleRegister };
