# Deployment Guide

## Production Setup

### 1. Environment Variables

Create a `.env` file in the `client` directory:

```env
# For production, set your API server URL
VITE_API_URL=https://api.yourdomain.com

# Or leave empty to use relative URLs (requires proxy)
# VITE_API_URL=
```

### 2. Build for Production

```bash
# Build the client
npm run build

# The built files will be in client/dist/
```

### 3. Deployment Options

#### Option A: Serve Frontend and Backend Separately

**Frontend (Static Files):**
- Deploy `client/dist/` to a static hosting service (Vercel, Netlify, GitHub Pages, etc.)
- Set `VITE_API_URL` to your backend API URL

**Backend (Node.js):**
- Deploy `server/` to a Node.js hosting service (Heroku, Railway, Render, etc.)
- Make sure to:
  - Set `NODE_ENV=production`
  - Install dependencies: `cd server && npm install`
  - Start server: `node index.js` or use PM2

#### Option B: Serve Both from Same Domain (Recommended)

Use a reverse proxy (nginx, Caddy, etc.) to serve both frontend and backend:

**nginx example:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve frontend
    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

With this setup, leave `VITE_API_URL` empty in `.env` to use relative URLs.

### 4. CORS Configuration

If frontend and backend are on different domains, update `server/index.js`:

```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://yourdomain.com',
  credentials: true
}));
```

### 5. Environment-Specific Configuration

**Development:**
- Uses Vite proxy (configured in `vite.config.ts`)
- Or uses `http://localhost:4000` if `VITE_API_URL` is not set

**Production:**
- Uses `VITE_API_URL` if set
- Otherwise uses relative URLs (requires proxy setup)

### 6. Server Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### 7. Build Scripts

Update `package.json` scripts if needed:

```json
{
  "scripts": {
    "build": "npm run build:client",
    "build:client": "cd client && npm run build",
    "start": "cd server && node index.js",
    "start:server": "cd server && npm start"
  }
}
```

### 8. Testing Production Build Locally

```bash
# Build client
npm run build

# Serve built files (optional, for testing)
cd client && npm run preview

# In another terminal, start server
cd server && npm start
```

### 9. Important Notes

- **API URLs**: All hardcoded `http://localhost:4000` URLs have been replaced with the `apiUrl()` helper function
- **Proxy**: Vite proxy only works in development. For production, use a reverse proxy or set `VITE_API_URL`
- **CORS**: Configure CORS on the backend if frontend and backend are on different domains
- **Environment Variables**: Vite requires `VITE_` prefix for environment variables to be exposed to the client

