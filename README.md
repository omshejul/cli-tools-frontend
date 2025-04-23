# Media Downloader Frontend

A modern, responsive web application for downloading videos from various platforms including YouTube, Vimeo, Instagram, Facebook, TikTok, and Twitter.

![Media Downloader Screenshot](https://github.com/yourusername/cli-tools-frontend/assets/screenshot.png)

## Features

- **Multi-Platform Support**: Download videos from YouTube, Vimeo, Instagram, Facebook, TikTok, Twitter, and more
- **Format Selection**: Choose from various quality options and formats (video or audio-only)
- **QuickTime Optimization**: Option to convert videos for better compatibility with QuickTime Player
- **Responsive UI**: Beautiful, mobile-friendly interface built with React and Tailwind CSS
- **Progress Tracking**: Real-time progress indicators during the download process
- **Download Link Management**: Temporary download links with automatic expiry
- **FFmpeg Integration**: Built-in guides for manual conversion using FFmpeg

## Prerequisites

- Node.js 18.0.0 or higher
- A compatible CLI Tools API server running (see Backend Setup)

## Getting Started

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/cli-tools-frontend.git
   cd cli-tools-frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:

   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   Replace the URL with your API server's address.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Backend Setup

This frontend requires a compatible API server to handle video processing. The default API endpoint is set to `https://cli.theom.app`, but you should set up your own server for development or production use.

The API server should provide the following endpoints:

- `/status` - GET request to check API availability
- `/formats` - POST request to get available formats for a URL
- `/info` - POST request to get video information
- `/download` - POST request to generate a download link

## Building for Production

```bash
npm run build
npm run start
```

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [React](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [React Hook Form](https://react-hook-form.com/) - Form validation
- [Sonner](https://sonner.emilkowal.ski/) - Toast notifications
- [Lucide](https://lucide.dev/) - Icon set

## Project Structure

- `app/` - Next.js application files
- `components/` - Reusable UI components
- `lib/` - Utility functions and API clients
- `public/` - Static assets

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
