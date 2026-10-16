# RepPilot API

FastAPI backend for accounts, cloud sync, the moderated community, messages and challenges.

```bash
cd apps/api
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # then edit; set MODERATOR_EMAILS to your email
uvicorn reppilot_api.main:app --reload --port 8000
pytest
```

Interactive API docs: http://localhost:8000/docs

Uses SQLite by default. For production set `DATABASE_URL` to PostgreSQL (`pip install -e ".[postgres]"`), set a long random `JWT_SECRET` and `REPPILOT_ENV=production`, and run behind HTTPS.

## Safety model

- **Adults only:** registration checks age 18+. The date of birth is not stored.
- **Text screening:** clearly sexual or self-harm-encouraging text is rejected. Borderline text (insults, body shaming, self-harm language, selling steroids) is saved but hidden until a moderator reviews it.
- **Photos and videos** are checked by type and file signature, and are never visible to anyone else until a moderator approves them.
- **Reports:** three reports from different people hide an item until review. Sexual, self-harm, violence and minor-safety reports are high priority.
- **Strikes:** removals add strikes. 3 strikes means a 7-day suspension from posting; 5 closes the account.
- **Appeals:** users see every decision about them and can appeal once. Appeals are reviewed by a different moderator. Overturning restores the content and removes the strike.
- **Blocking** hides people from each other everywhere (feed, search, comments, messages, leaderboards) and ends the friendship. Messages are friends-only.
- **Rate limits** apply to posts, comments, messages, friend requests, reports, uploads and logins. They are in-process: use Redis if you run several workers.
- **Challenges:** one attempt per day. Implausible results and big jumps on heavy lifts are held for review. The bench challenge is a 5-rep best, never a one-rep max. Leaderboards have experience divisions, a friends-only view, a "most improved" mode and an opt-out.
