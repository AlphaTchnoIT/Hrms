import dotenv from 'dotenv';

dotenv.config();

// CLIENT_URL can hold several comma separated URLs. Browsers send only the origin
// (scheme + host), so "https://app.com/login/" is reduced to "https://app.com".
function toOrigins(value) {
  return value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => {
      try {
        return new URL(url).origin;
      } catch {
        return url.replace(/\/+$/, '');
      }
    });
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: toOrigins(process.env.CLIENT_URL || 'http://localhost:3000'),
};
