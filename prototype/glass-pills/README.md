# Glass Pills prototype — Sonuswealth

This folder contains a small React + Vite prototype demonstrating the glass theme, reorderable pills (dnd-kit), and validation (React Hook Form + Zod).

Quick start

1. Clone the repo and checkout the Glass branch:

   git clone https://github.com/mpatel517-gif/sonuswealth.git
   cd sonuswealth
   git checkout Glass

2. Run locally:

   cd prototype/glass-pills
   npm install
   npm run dev

3. Open the printed URL (usually http://localhost:5173)

Deploy to Vercel — using Dashboard

1. Go to https://vercel.com and import the GitHub project "mpatel517-gif/sonuswealth".
2. When configuring the project set:
   - Root Directory: prototype/glass-pills
   - Build Command: npm run build
   - Output Directory: dist
   - Production Branch: Glass
3. Click Deploy.

Deploy via Vercel CLI (optional)

1. Install Vercel CLI: npm i -g vercel
2. From this folder (prototype/glass-pills) run: vercel --prod


