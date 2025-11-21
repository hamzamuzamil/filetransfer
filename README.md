# P2P File Share Pro 

A production-ready, peer-to-peer file sharing application with end-to-end encryption, resume capability, and optimized memory management for large files.

## ✨ Features

### Core Features
- **🔒 End-to-End Encryption**: Optional password protection using AES-256-GCM encryption
- **⚡ Direct P2P Transfer**: WebRTC-based direct browser-to-browser file sharing
- **🔄 Resume Capability**: Interrupt and resume transfers without losing progress
- **💾 Large File Support**: Optimized memory management for files of any size
- **📊 Progress Persistence**: Transfer progress saved across page refreshes
- **🌓 Dark Mode**: Beautiful UI with dark mode support
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices

### Advanced Features
- **Chunk-based Transfer**: Files split into 256KB chunks for optimal performance
- **IndexedDB Storage**: Persistent storage for resume capability
- **Memory Optimization**: Automatic memory management to prevent browser crashes
- **Connection Monitoring**: Real-time connection quality detection
- **Battery Awareness**: Throttles transfers on low battery (mobile devices)
- **Error Boundaries**: Comprehensive error handling with graceful fallbacks
- **Performance Monitoring**: Built-in performance metrics and monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd p2p-file-share

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 How It Works

### Sending Files

1. **Select Files**: Drag and drop or click to select files to share
2. **Set Password** (Optional): Toggle password protection and set a secure password
3. **Generate Link**: Click "Generate Share Link" to create a unique sharing URL
4. **Share**: Send the link (and password if used) to the recipient
5. **Transfer**: Once the recipient opens the link, the transfer begins automatically

### Receiving Files

1. **Open Link**: Click on the shared link received from the sender
2. **Enter Password** (If required): Enter the password provided by the sender
3. **Wait for Transfer**: The files will be transferred directly to your browser
4. **Download**: Once complete, click "Download" to save the files to your device

### Resume Interrupted Transfers

If a transfer is interrupted (connection lost, page refresh, etc.):

1. **Automatic Detection**: The app detects incomplete transfers
2. **Resume Dialog**: A dialog appears asking if you want to resume
3. **Continue Transfer**: Click "Resume Transfer" to continue from where it left off
4. **Or Start Fresh**: Click "Start Fresh" to begin a new transfer

## 🏗️ Architecture

### Technology Stack

- **Frontend Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion
- **P2P Communication**: WebRTC via PeerJS
- **Encryption**: Web Crypto API (AES-256-GCM)
- **Storage**: IndexedDB for persistence
- **TypeScript**: Full type safety

### Key Components

#### File Transfer Manager (`lib/fileTransferEnhanced.ts`)
- Handles chunked file transfers
- Implements encryption/decryption
- Manages resume capability
- Optimizes memory usage

#### Encryption Manager (`lib/encryption.ts`)
- AES-256-GCM encryption
- PBKDF2 key derivation
- Password verification

#### Storage Manager (`lib/storage.ts`)
- IndexedDB operations
- Transfer state persistence
- Chunk storage for resume

#### WebRTC Manager (`lib/webrtc.ts`)
- P2P connection management
- Data channel handling
- Connection state monitoring

## 🔐 Security Features

### Password Protection
- **AES-256-GCM Encryption**: Military-grade encryption
- **PBKDF2 Key Derivation**: 100,000 iterations with random salt
- **Password Verification**: Secure password checking without exposing the actual password
- **Encrypted Chunks**: Each chunk is individually encrypted

### Privacy
- **No Server Storage**: Files never touch any server
- **Direct P2P**: Transfers happen directly between browsers
- **Temporary Connections**: Connection IDs expire after use
- **No Tracking**: No analytics or user tracking

## 📊 Performance Optimizations

### Memory Management
- **Streaming Processing**: Files processed in chunks, not loaded entirely into memory
- **Chunk Size Optimization**: 256KB chunks for optimal performance
- **Memory Pressure Detection**: Monitors memory usage and adjusts accordingly
- **Garbage Collection Hints**: Proactive memory cleanup

### Transfer Optimization
- **Adaptive Chunk Size**: Can adjust based on connection quality
- **Connection Quality Monitoring**: Detects slow connections
- **Battery Awareness**: Throttles on low battery
- **Progress Persistence**: Resume from exact byte position

### Code Optimization
- **Code Splitting**: Dynamic imports for better load times
- **Tree Shaking**: Removes unused code
- **Minification**: Production builds are fully minified
- **Compression**: Gzip/Brotli compression enabled

## 🌐 Browser Compatibility

### Fully Supported
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

### Required APIs
- WebRTC
- Web Crypto API
- IndexedDB
- File API
- ReadableStream

## 🚢 Production Deployment

### Build for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Deployment Platforms

#### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
netlify deploy --prod
```

#### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

Create a `.env.local` file:

```env
# Optional: Custom PeerJS server
NEXT_PUBLIC_PEERJS_HOST=0.peerjs.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/

# Optional: Analytics (if you add them later)
# NEXT_PUBLIC_ANALYTICS_ID=your-id
```

### Performance Checklist

- [ ] Enable HTTP/2 or HTTP/3
- [ ] Configure CDN for static assets
- [ ] Enable Gzip/Brotli compression
- [ ] Set up proper caching headers
- [ ] Configure CORS if needed
- [ ] Enable HTTPS (required for WebRTC)
- [ ] Set up monitoring and error tracking
- [ ] Configure rate limiting
- [ ] Set up backup PeerJS server (optional)

## 🔧 Configuration

### Chunk Size
Adjust in `lib/fileTransferEnhanced.ts`:
```typescript
const CHUNK_SIZE = 256 * 1024; // 256KB
```

### Connection Timeout
Adjust in `app/page.tsx`:
```typescript
await webrtc.waitForConnection(90000); // 90 seconds
```

### Storage Expiration
Adjust in `lib/storage.ts`:
```typescript
expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
```

## 🐛 Troubleshooting

### Connection Issues
- Ensure both parties have stable internet
- Check firewall/antivirus settings
- Try using a VPN if corporate network blocks WebRTC
- Verify HTTPS is enabled (WebRTC requirement)

### Transfer Failures
- Check browser console for errors
- Verify sufficient disk space
- Check IndexedDB quota
- Try with smaller files first
- Disable browser extensions that might interfere

### Resume Not Working
- Check IndexedDB is enabled in browser
- Verify storage quota not exceeded
- Check browser console for storage errors
- Try clearing site data and starting fresh

## 📝 Best Practices

### For Senders
1. Use password protection for sensitive files
2. Share the link securely (encrypted messaging)
3. Don't close the browser tab until transfer completes
4. Test with small files first for large transfers
5. Ensure stable internet connection

### For Recipients
1. Open the link as soon as possible
2. Keep the browser tab active during transfer
3. Have sufficient disk space available
4. Don't refresh the page during transfer (or use resume)
5. Save the password securely if one is provided

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🙏 Acknowledgments

- [PeerJS](https://peerjs.com/) - WebRTC abstraction
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide Icons](https://lucide.dev/) - Icon library

## 📞 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Built with ❤️ using Next.js and WebRTC**
