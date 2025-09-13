# Local Database Setup

Your app is now configured to support both local SQLite and remote Neon PostgreSQL databases! 🎉

## Quick Switch Commands

### Switch to Local SQLite Database
```bash
node switch-to-local-db.js
```

### Switch to Remote Neon Database
```bash
node switch-to-remote-db.js
```

**Important:** After running either command, restart the application to apply the changes.

## Manual Setup (Alternative Method)

If you prefer manual setup, follow these steps:

### To Use Local SQLite Database:
1. **Replace database file:** Copy the content from `server/db-setup-sqlite.ts` and replace the content in `server/db.ts`
2. **Restart the server**

### To Use Remote Neon Database:
1. **Restore original:** Use git to restore the original `server/db.ts` file
2. **Restart the server**

## Demo Users (Same for Both Databases)

After switching to local database, use these demo accounts:

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| `ministry.admin` | `admin123` | ministry | Ministry Administrator |
| `mp.admin` | `state123` | state | MP State Administrator |
| `district.officer` | `district123` | district | District Officer |
| `village.officer` | `village123` | village | Village Officer |

## Database Files

- **Local SQLite:** Creates `local-database.db` in your project root
- **Remote Neon:** Uses the existing `DATABASE_URL` environment variable

## Benefits of Each Setup

### Local SQLite Database ✨
- ✅ **Fast development** - No network latency
- ✅ **Offline work** - Works without internet
- ✅ **Data persistence** - Data saved to local file
- ✅ **Easy reset** - Just delete the `.db` file
- ✅ **No connection limits** - No external dependencies

### Remote Neon Database ☁️  
- ✅ **Production-ready** - Scalable cloud database
- ✅ **Collaboration** - Shared data across team members
- ✅ **Automatic backups** - Built-in data protection
- ✅ **Advanced features** - PostGIS, full PostgreSQL support

## Current Status

Your app is currently using: **Remote Neon PostgreSQL Database** ☁️

Run `node switch-to-local-db.js` and restart the server to switch to local development!