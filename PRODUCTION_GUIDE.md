# Production Deployment Guide

Complete guide for deploying P2P File Share Pro to production.

## Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed
- [ ] No console.logs in production code (except errors/warnings)
- [ ] Error boundaries in place
- [ ] Loading states implemented
- [ ] Error messages user-friendly

### Testing
- [ ] Test file uploads (small files)
- [ ] Test file uploads (large files >1GB)
- [ ] Test password protection
- [ ] Test resume capability
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Test with slow connections
- [ ] Test error scenarios

### Security
- [ ] HTTPS enabled (required for WebRTC)
- [ ] Security headers configured
- [ ] CORS properly set up
- [ ] Password requirements enforced
- [ ] No sensitive data in client code
- [ ] Rate limiting considered

### Performance
- [ ] Build optimized (npm run build)
- [ ] Chunks properly split
- [ ] Images optimized
- [ ] Fonts optimized
- [ ] Compression enabled
- [ ] Caching headers set

## Deployment Steps

### 1. Prepare the Build

```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Run type checking
npx tsc --noEmit

# Build for production
npm run build

# Test production build locally
npm start
```

### 2. Environment Setup

Create `.env.production`:

```env
# Production settings
NODE_ENV=production
NEXT_PUBLIC_PEERJS_HOST=0.peerjs.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/

# Optional: Custom domain
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Set environment variables in Vercel dashboard
# Go to: Settings > Environment Variables
```

### 4. Deploy to Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

### 5. Deploy to Custom Server (Ubuntu/Debian)

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone and build
git clone <your-repo>
cd p2p-file-share
npm ci --only=production
npm run build

# Start with PM2
pm2 start npm --name "p2p-share" -- start
pm2 save
pm2 startup

# Set up Nginx reverse proxy
sudo apt-get install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/p2p-share
```

Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourapp.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/p2p-share /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Set up SSL with Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourapp.com
```

### 6. Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
```

Deploy:

```bash
docker-compose up -d
```

## Post-Deployment

### 1. Monitoring Setup

Add error tracking (e.g., Sentry):

```bash
npm install @sentry/nextjs
```

Initialize Sentry in `lib/monitoring.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: 'production',
  });
}
```

### 2. Analytics (Optional)

Add Google Analytics or Plausible:

```typescript
// lib/analytics.ts
export const trackEvent = (name: string, properties?: any) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, properties);
  }
};
```

### 3. Performance Monitoring

Add `web-vitals` tracking:

```bash
npm install web-vitals
```

```typescript
// app/layout.tsx
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

if (typeof window !== 'undefined') {
  onCLS(console.log);
  onFID(console.log);
  onFCP(console.log);
  onLCP(console.log);
  onTTFB(console.log);
}
```

### 4. CDN Setup

Configure CDN for static assets:

- **Cloudflare**: Add site, update nameservers
- **AWS CloudFront**: Create distribution, point to origin
- **Vercel**: Automatic CDN included

### 5. Database/API Setup (If needed)

If you add features that require a backend:

```bash
# Set up PostgreSQL
sudo apt-get install postgresql

# Or use managed database
# - Supabase
# - PlanetScale
# - AWS RDS
```

## Scaling Considerations

### PeerJS Server

For high traffic, set up your own PeerJS server:

```bash
# Install PeerJS server
npm install peer -g

# Run server
peerjs --port 9000 --key peerjs --path /myapp

# Or with PM2
pm2 start peerjs -- --port 9000 --key peerjs --path /myapp
```

Update client configuration:

```typescript
const peer = new Peer({
  host: 'your-peerjs-server.com',
  port: 9000,
  path: '/myapp',
  secure: true,
});
```

### Load Balancing

For multiple instances:

```nginx
upstream p2p_share {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    location / {
        proxy_pass http://p2p_share;
    }
}
```

### Caching Strategy

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~* \.(html)$ {
    expires 5m;
    add_header Cache-Control "public, must-revalidate";
}
```

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update
npm audit fix

# Test thoroughly
npm test
npm run build

# Deploy
git push origin main
```

### Backup Strategy

- Regular database backups (if applicable)
- Config file backups
- SSL certificate backups
- Application logs backup

### Monitoring Checklist

- [ ] Server CPU/Memory usage
- [ ] Application errors
- [ ] Transfer success rate
- [ ] Average transfer speed
- [ ] User connection issues
- [ ] Storage quota usage
- [ ] SSL certificate expiration

## Troubleshooting Production Issues

### High Memory Usage

```bash
# Check Node.js memory
node --max-old-space-size=4096 server.js

# Monitor with PM2
pm2 monit
```

### WebRTC Connection Failures

1. Check STUN/TURN server configuration
2. Verify firewall rules
3. Check NAT traversal
4. Consider adding TURN server

### Performance Issues

1. Enable compression
2. Optimize chunk size
3. Check network bandwidth
4. Monitor memory leaks
5. Profile with DevTools

## Security Hardening

### Headers

Already configured in `next.config.js`:
- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

### Additional Security

```bash
# Fail2ban for brute force protection
sudo apt-get install fail2ban

# UFW firewall
sudo ufw enable
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
```

## Cost Optimization

### Vercel
- Free tier: 100GB bandwidth/month
- Pro: $20/month for more bandwidth
- Enterprise: Custom pricing

### Netlify
- Free tier: 100GB bandwidth/month
- Pro: $19/month

### AWS
- EC2 t3.micro: ~$8/month
- + Bandwidth costs
- + SSL certificate (free with Let's Encrypt)

### DigitalOcean
- Droplet: $4-6/month
- + Bandwidth included
- + Managed databases if needed

## Support & Maintenance

### Documentation
- Keep README updated
- Document any custom configurations
- Maintain changelog
- Update deployment guide as needed

### User Support
- Set up support email
- Create FAQ section
- Add status page
- Provide troubleshooting guide

---

**Remember**: Always test thoroughly in staging before deploying to production!

