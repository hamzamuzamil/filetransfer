# 🚀 Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## How to Use

### Sending Files:

1. **Select Files**: Drag and drop files or click to select
2. **Generate Link**: Click "Generate Share Link"
3. **Share**: Copy the link and send it to the recipient
4. **Wait**: Wait for recipient to connect
5. **Transfer**: Files will transfer automatically

### Receiving Files:

1. **Open Link**: Click the shared link
2. **Connect**: Wait for connection to establish
3. **Receive**: Files will download automatically
4. **Download**: Click "Download" button when complete

## Features

✅ **Zero Quality Loss** - Files are transferred as binary chunks, preserving 100% quality
✅ **Direct P2P** - Files never touch any server
✅ **Multi-File Support** - Share multiple files at once
✅ **Real-time Progress** - See transfer speed and time remaining
✅ **Dark Mode** - Toggle between light and dark themes
✅ **Mobile Responsive** - Works on all devices

## Technology

- **WebRTC**: For peer-to-peer connections
- **PeerJS**: Simplified WebRTC implementation
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe code
- **Tailwind CSS**: Modern styling
- **Framer Motion**: Smooth animations

## Troubleshooting

### Connection Issues:
- Make sure both users are on the same network or have proper NAT traversal
- Try refreshing the page
- Check browser console for errors

### File Transfer Issues:
- Ensure stable internet connection
- Try with smaller files first
- Check browser compatibility (Chrome, Firefox, Edge recommended)

## Browser Support

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari (Limited WebRTC support)
- ❌ Internet Explorer (Not supported)

## Notes

- Files are transferred directly between browsers
- No file size limits (limited by browser memory)
- Transfer speed depends on network connection
- Connection requires both users to be online simultaneously

