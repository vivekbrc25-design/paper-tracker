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
