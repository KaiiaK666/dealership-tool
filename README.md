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
username: admin
password: admin123
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

Frontend:

- `VITE_API_BASE`

### Recommended values

- `VITE_API_BASE=https://your-api-service.onrender.com`
- `DEALER_CORS_ORIGINS=https://your-frontend-service.onrender.com,https://yourdomain.com,https://www.yourdomain.com`

### Custom domain setup

Typical production setup:

- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`

Then set:

- `VITE_API_BASE=https://api.yourdomain.com`
- `DEALER_CORS_ORIGINS=https://app.yourdomain.com,https://yourdomain.com,https://www.yourdomain.com`

If you want a single-domain setup later, the frontend can also be served from the same origin, but the current Render blueprint is set up for the simpler two-service layout.
