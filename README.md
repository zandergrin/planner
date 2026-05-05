# Site Planner — Venn Creative

**Live:** https://planner.venncreative.co.uk/

## Local Development

```
npm install
npm run dev
```

Opens at **http://localhost:5173**

Requires a `.env` file (not committed) with:
```
VITE_JSONBIN_API_KEY=your_key_here
```

## Backup & Restore

```
npm run backup              # snapshot all live data to backups/<timestamp>/
npm run restore <timestamp> # restore from a backup (confirms first, takes safety backup)
```
