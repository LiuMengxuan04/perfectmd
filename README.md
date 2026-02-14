# Markdown Editor

A modern Markdown editor combining Typora's simplicity with Word's rich formatting capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## ✨ Features

- **Rich Text Formatting**: Bold, italic, underline, strikethrough, inline code
- **Text Styling**: Text color, highlight color, font size adjustment
- **Headings**: H1, H2, H3 with visual detection
- **Lists**: Bullet lists and ordered lists
- **Block Elements**: Blockquotes, horizontal rules
- **Links**: Easy link insertion
- **Dark Mode**: Full dark/light theme support
- **Auto-save**: Automatic saving with debounce
- **Document Management**: Create, delete, pin documents
- **Search**: Quick document search
- **Export**: Export to Markdown format
- **Backup/Restore**: Full data backup and restore functionality
- **Local Storage**: All data stored locally in your browser

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/markdown-editor.git
cd markdown-editor
```

2. Install dependencies:
```bash
# Using bun (recommended)
bun install

# Or using npm
npm install
```

3. Start the development server:
```bash
# Using bun
bun run dev

# Or using npm
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Deployment

### Deploy to Vercel (Recommended)

The easiest way to deploy this app is to use [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Vercel will automatically detect Next.js and configure the build
4. Click "Deploy"

Your app will be live at `https://your-project.vercel.app`

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/markdown-editor)

### Deploy to Netlify

1. Push your code to GitHub
2. Connect your repository in [Netlify](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Deploy

## 🖥️ Desktop App (Tauri)

This project supports building desktop applications using Tauri.

### Prerequisites for Desktop Build

- [Rust](https://www.rust-lang.org/tools/install)
- Platform-specific dependencies:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Build Desktop App

1. Install Tauri CLI:
```bash
# Already included in package.json dependencies
```

2. Development:
```bash
bun run tauri:dev
```

3. Build for production:
```bash
bun run tauri:build
```

The built applications will be in `src-tauri/target/release/bundle/`:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` installer
- **Linux**: `.deb` and `.AppImage`

## 📁 Project Structure

```
markdown-editor/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── page.tsx            # Main page
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── editor/             # Editor components
│   │   │   ├── MarkdownEditor.tsx
│   │   │   ├── FloatingToolbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── EmptyState.tsx
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── local-storage.ts    # IndexedDB storage layer
│   │   └── html-to-markdown.ts # Export utility
│   └── store/
│       └── editor-store.ts     # Zustand state management
├── src-tauri/                  # Tauri desktop app config
│   ├── src/
│   │   └── main.rs             # Rust entry point
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── public/                     # Static assets
├── package.json
├── next.config.ts
└── README.md
```

## 🔧 Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Storage**: IndexedDB (browser local storage)
- **Desktop**: [Tauri 2.0](https://tauri.app/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 💾 Data Storage

This application uses **IndexedDB** for local storage. All your documents are stored in your browser:

- **No server required**: Everything runs locally
- **Privacy first**: Your data never leaves your device
- **Offline support**: Works without internet connection
- **Backup feature**: Export all data as JSON for backup

### Backup & Restore

1. Click the database icon in the sidebar
2. Select "Backup All Data" to download a JSON file
3. To restore, select "Restore from Backup" and choose your backup file

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + U` | Underline |
| `Ctrl/Cmd + S` | Save document |
| `Tab` | Insert indentation |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Typora](https://typora.io/) for inspiration on simplicity
- [Notion](https://notion.so) for the block editor concept
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components

---

Made with ❤️ by [Your Name]
