# Dealership Tool

Local app for:

- Admin-managed salesperson roster
- Monthly Kia and Mazda service-drive calendar
- BDC lead round robin
- Immutable assignment log
- Filterable BDC reporting
- Embedded service-drive traffic iframe

## Run

Backend:

```powershell
Copy-Item backend\.env.example backend\.env
# Edit backend\.env and set DEALER_ADMIN_USERNAME / DEALER_ADMIN_PASSWORD
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8108
```

Frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:4183
```

Admin login:

```text
The backend auto-loads backend/.env when present.
Set DEALER_ADMIN_USERNAME and DEALER_ADMIN_PASSWORD there before signing in.
```

## Deploy To Render

This repo now includes a [render.yaml](./render.yaml) blueprint for:

- `dealership-tool-web`: Render Static Site for the React frontend
- `dealership-tool-api`: Render Web Service for the FastAPI backend

### Before you deploy

1. Push this folder to its own GitHub repo.
2. Create a Render account and connect that repo.
3. Use `Blueprint` deploy so Render reads `render.yaml`.

### Required Render env vars

Backend:

- `DEALER_ADMIN_USERNAME`
- `DEALER_ADMIN_PASSWORD`
- `DEALER_CORS_ORIGINS`
- `OPENAI_API_KEY` for Agent Loops
- `OPENAI_AGENT_MODEL` optional, defaults to `gpt-5.4-mini`
- `OPENAI_AGENT_REASONING_EFFORT` optional, defaults to `low`
- `OPENAI_AGENT_MAX_STEPS` optional, defaults to `6`

Frontend:

- `VITE_API_BASE`
- `VITE_TRAFFIC_URL` (optional)

### Recommended values

- `VITE_API_BASE=https://your-api-service.onrender.com`
- `VITE_TRAFFIC_URL=https://traffic.yourdomain.com`
- `DEALER_CORS_ORIGINS=https://your-frontend-service.onrender.com,https://yourdomain.com,https://www.yourdomain.com`
- `OPENAI_AGENT_MODEL=gpt-5.4-mini`
- `OPENAI_AGENT_REASONING_EFFORT=low`
- `OPENAI_AGENT_MAX_STEPS=6`

The frontend also auto-detects these common production hosts without another code change:

- `dealership-tool-web.onrender.com` -> `dealership-tool-api.onrender.com`
- `app.bertogden123.com` -> `api.bertogden123.com`

### Custom domain setup

Typical production setup:

- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`

Then set:

- `VITE_API_BASE=https://api.yourdomain.com`
- `DEALER_CORS_ORIGINS=https://app.yourdomain.com,https://yourdomain.com,https://www.yourdomain.com`

If you want a single-domain setup later, the frontend can also be served from the same origin, but the current Render blueprint is set up for the simpler two-service layout.
