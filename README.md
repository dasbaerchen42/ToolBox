# Das Baerchen Tool Box

A web-based writing toolbox built with Next.js and TypeScript.

It includes a writing editor, utility tools, and Google Docs related integration through Google OAuth.

## Features

- Writing editor
- Fullwidth conversion tool
- Knife tool
- Google OAuth integration
- Built with Next.js App Router

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Google OAuth

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
cd YOUR_REPOSITORY_NAME
2. Install dependencies
npm install
3. Set up environment variables

Create a .env.local file in the project root:

NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here

You can copy from .env.example.

4. Run the development server
npm run dev

Then open http://localhost:3000.

Environment Variables
NEXT_PUBLIC_GOOGLE_CLIENT_ID

Google OAuth Client ID used by the frontend.

This value is public-facing by design, but it should still be restricted in Google Cloud Console by setting the correct Authorized JavaScript origins.

Deployment

This project can be deployed on Vercel.

Before deploying, make sure:

NEXT_PUBLIC_GOOGLE_CLIENT_ID is set in Vercel Environment Variables
Google OAuth Authorized JavaScript origins include:
http://localhost:3000
your Vercel production domain
Security Notes
Do not commit .env.local
Do not commit credential JSON files or private keys
Sensitive files are excluded through .gitignore
License

Personal project / custom license
