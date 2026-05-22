# Paper Tracker

FastAPI + React + MongoDB version of the original `paper_tracker.html` prototype.

## Structure

- `paper_tracker.html`: original single-file prototype
- `backend/`: FastAPI API and MongoDB persistence
- `frontend/`: React app split into routes and reusable components

## Run

1. Start MongoDB locally.
2. Copy `backend/.env.example` to `backend/.env` if you want custom values.
3. Start the API:

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

4. Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Deploy On Railway

This repo is set up for Railway as an isolated monorepo with:

- one `backend` service for FastAPI
- one `frontend` service for the React app
- one MongoDB service from Railway's database template

### What is already configured

- [backend/Dockerfile](backend/Dockerfile) runs FastAPI with Uvicorn on Railway's `PORT`
- [frontend/Dockerfile](frontend/Dockerfile) builds the Vite app and serves it with Nginx
- [frontend/nginx/default.conf.template](frontend/nginx/default.conf.template) proxies `/api` to the backend over Railway private networking

### Railway setup

1. Push this repo to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add a service for `backend` and set its root directory to `backend`.
4. Add a service for `frontend` and set its root directory to `frontend`.
5. Add a MongoDB service from Railway's MongoDB template.
6. Keep the backend service name as `backend`, or update the frontend `BACKEND_URL` variable to match your backend service name.
7. Generate a public domain only for the `frontend` service. The backend can stay private.

### Backend variables

Set these in the `backend` service:

- `MONGO_URI=${{YOUR_MONGO_SERVICE_NAME.MONGO_URL}}`
- `MONGO_DB_NAME=paper_tracker`
- `ADMIN_USER_ID=adminbrc`
- `ADMIN_PASSWORD=brc@123`

`FRONTEND_ORIGIN` is optional in this setup because the browser talks to the frontend service and the frontend proxies `/api` internally.

### Frontend variables

Set this in the `frontend` service if your backend service name is not exactly `backend`:

- `BACKEND_URL=http://YOUR_BACKEND_SERVICE_NAME.railway.internal:8000`

### Notes

- The login session token is stored in backend memory, so restarting the backend logs users out.
- Railway private networking uses the internal `*.railway.internal` hostname for service-to-service traffic.
- The frontend uses SPA routing, so direct visits to `/papers`, `/reports`, and `/config` continue to work in production.

## Implemented

- React routes for `papers`, `reports`, and `config`
- FastAPI CRUD APIs for universities, exam sessions, operators, and papers
- MongoDB-backed seed/reset flow using the original HTML mock data
- Paper filters, pagination, edit modal, bulk updates, and bulk delete
- Reports charts and operator/timeline views
- Assignment history tracking in the backend so stage/operator timing can be used for future reporting

## Timing Note

Whenever a paper changes assignee or stage, the backend now closes the previous active assignment history entry as:

- `completed` when the paper moves forward in the workflow
- `returned` when the operator is removed or the work leaves that stage without completion

New assignments automatically open a fresh active history entry.
