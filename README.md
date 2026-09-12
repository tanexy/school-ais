# Acacia College School Management System

A complete school management and accounting system. It keeps track of **students, fees, payments, expenses, suppliers, staff and payroll, inventory, assets**, and produces **accounting reports** (trial balance, income & expenditure, statement of financial position, cashbook and more).

It has built-in **demo data** so you can explore everything straight away.

---

## What you need

- A computer with **Windows 10 or 11** (the easiest way to run this).
- **Internet** (needed only the first time, to download a few programs).
- Any modern web browser: **Chrome, Edge or Firefox**.

You do **not** need to install anything else by hand. The one-click script below downloads Node.js for you. No Python, no Visual Studio, no "build tools" are ever needed - the database engine is built into Node.js.

---

## Level 1: Run it with one click (Windows only - easiest)

1. Get the project folder:
   - **From GitHub:** go to the repository page, click the green **Code** button, choose **Download ZIP**, and save the file.
   - **From Google Drive:** click the download button and save the ZIP file.
2. Find the downloaded ZIP file and **right-click it -> "Extract All..."** (Windows 11: double-click it, then click "Extract all").
3. Open the folder that was created. It contains a file called **`start-school.bat`**.
4. **Double-click `start-school.bat`** and follow the messages in the window.

The script will:
- Download a portable copy of Node.js (about 30 MB, one time only),
- Install the program's packages (one time only),
- Create the database with sample data (one time only),
- Check the database is working,
- Start the system, wait until it is really running, and then open it in your browser.

> If Windows shows a **"Windows protected your PC"** warning for the script, click **"More info"** then **"Run anyway"** - it is our own file, not a virus.
>
> If Windows asks you to **allow the app through the firewall**, tick "Private networks" and press **Allow** - this is normal.

**Your browser will open the app automatically.** If it does not, type this in the address bar:
```
http://localhost:5173
```

### Logging in (demo accounts)

| Role          | Email                 | Password   |
|---------------|-----------------------|------------|
| Administrator | admin@school.com      | admin123   |
| Bursar        | bursar@school.com     | bursar123  |
| Teacher       | teacher@school.com    | teacher123 |
| Headmaster    | headmaster@school.com | headmaster123 |

### Stopping the system

Close the two small console windows whose titles begin with **"Acacia -"**. (Or press `Ctrl + C` in each of those windows.) The page in the browser will stop loading after that.

---

## Level 2: Start it manually (Windows, Mac or Linux)

Use this if you prefer Terminal, or if you are on a Mac/Linux computer.

### 1. Install Node.js

Download the **LTS** version (22.13 or newer, preferably the latest 24 LTS) from **[https://nodejs.org](https://nodejs.org)** and install it with the default options. The database engine is built into Node.js, so an older version than 22.13 will not work.
Verify it works by opening a terminal and running:
```bash
node --version
```
It should print a version number like `v24.x.x`.

### 2. Open a terminal in the project folder

- **Windows:** open the extracted folder, click the address bar, type `cmd` and press Enter.
- **Mac / Linux:** open Terminal and type `cd ` (with a space), then drag the folder into the window and press Enter.

### 3. Install the packages

Run these three commands, one at a time, waiting for each to finish:
```bash
cd backend
npm install
cd ..
cd frontend
npm install
cd ..
```

### 4. Create the database and demo data

```bash
cd backend
node migrate.js
node seed.js
cd ..
```

### 5. Start the system

You need **two terminal windows**.

- **Window 1** (the backend / server):
  ```bash
  cd backend
  npm start
  ```
- **Window 2** (the frontend / page):
  ```bash
  cd frontend
  npm run dev
  ```

Wait until the second window shows something like `Local: http://localhost:5173/`. Then open that address in your browser.

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| `node is not recognized` / `node: command not found` | Node.js was not installed properly. Run the installer again from nodejs.org and restart the terminal. |
| `npm install` shows errors | Check your internet connection and try again. |
| `npm install` says it needs **Visual Studio** or **Python** | This only happens with very old copies of the system. The database engine is now built into Node.js, so nothing needs to be compiled. Delete the whole folder, download the ZIP again, and extract it fresh. |
| "Port 3001 or 5173 already in use" | A copy of the system is probably already running. Close its windows, or restart your computer. |
| The page is blank or won't load | Both tiny console windows titled **"Acacia -"** must stay open. If one of them shows red error text, screenshot it and send it to whoever set up the system. |
| `start-school.bat` does nothing | Right-click it -> "Run as administrator", then "More info -> Run anyway" if Windows blocks it. |
| The system used to work but now won't start | Delete the `tools` folder and the `install.log` file, then run `start-school.bat` again. |

> The two small windows are started by a helper file called `run-server.bat` that sits next to `start-school.bat`. Keep both files in the same folder.

To start again later, just double-click **`start-school.bat`** again, or repeat Level 2 - step 5.

---

## For developers

- **Backend:** Node.js + Express (port 3001), SQLite via Node's built-in `node:sqlite` (no native modules), JWT auth.
  - `npm start` - run the API server
  - `npm run seed` - reset the database with fresh demo data
- **Frontend:** React + TypeScript + Vite (port 5173), TanStack Query.
  - `npm run dev` - development server
  - `npm run build` - production build
- Seeded automatically by `start-school.bat` / `migrate.js + seed.js`.

> The SQLite database file (`school.db`) is created on first run from the seed script - the repository intentionally does not ship the database file.