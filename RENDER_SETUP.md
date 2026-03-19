# Render Setup

This app is already configured for the recommended low-cost production setup:

- Frontend: Render Static Site
- Backend: Render Web Service on `Starter`
- Database: SQLite on a Render persistent disk

## 1. Push this folder to GitHub

Use this folder as its own repo:

`c:\Users\pando\OneDrive\Desktop\dealership-tool`

## 2. Deploy from `render.yaml`

In Render:

1. `New +`
2. `Blueprint`
3. Select your GitHub repo
4. Render will read `render.yaml`

That will create:

- `dealership-tool-api`
- `dealership-tool-web`

## 3. Exact Render service values

Backend service:

- Type: `Web Service`
- Name: `dealership-tool-api`
- Runtime: `Python`
- Root Directory: `backend`
- Plan: `Starter`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`
- Disk Mount Path: `/var/data`
- Disk Size: `5 GB`

Backend env vars:

- `PORT=10000`
- `DEALER_DB_PATH=/var/data/dealership.db`
- `DEALER_TIMEZONE=America/Chicago`
- `DEALER_ADMIN_USERNAME=admin`
- `DEALER_ADMIN_PASSWORD=change-this-to-a-real-password`
- `DEALER_CORS_ORIGINS=https://app.yourdomain.com`

Frontend service:

- Type: `Static Site`
- Name: `dealership-tool-web`
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Rewrite Rule: `/*` -> `/index.html`

Frontend env vars:

- `VITE_API_BASE=https://api.yourdomain.com`

The frontend can also auto-detect the API host for these production URLs:

- `https://dealership-tool-web.onrender.com` -> `https://dealership-tool-api.onrender.com`
- `https://app.bertogden123.com` -> `https://api.bertogden123.com`

## 4. First deploy before custom domains

After the first deploy, Render will give you two temporary URLs like:

- `https://dealership-tool-web.onrender.com`
- `https://dealership-tool-api.onrender.com`

Use those temporarily like this:

- `VITE_API_BASE=https://dealership-tool-api.onrender.com`
- `DEALER_CORS_ORIGINS=https://dealership-tool-web.onrender.com`

Redeploy after saving the env vars.

## 5. Custom domains

Recommended production layout:

- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`

In Render:

1. Open the frontend service
2. Add custom domain `app.yourdomain.com`
3. Open the backend service
4. Add custom domain `api.yourdomain.com`

Render will show you the DNS records to create at your registrar.

Once DNS is live, update env vars to:

- `VITE_API_BASE=https://api.yourdomain.com`
- `DEALER_CORS_ORIGINS=https://app.yourdomain.com`

Then redeploy both services.

## 6. Registrar DNS

Your registrar could be Cloudflare, Namecheap, Porkbun, GoDaddy, etc.

The exact DNS target comes from Render, so copy the value Render shows.

Typical flow:

1. Add `app` record for the frontend target Render gives you
2. Add `api` record for the backend target Render gives you
3. Wait for DNS to propagate
4. Click `Verify` in Render

## 7. Important note about SQLite

This setup is fine for a small internal tool, but the backend must stay on a paid Render service with a persistent disk. Do not move the backend to a free instance if you want the SQLite data to persist.
