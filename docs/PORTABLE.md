# Aviation Insight for Windows — Electron desktop edition

## Run

Double-click `dist/portable/AviationInsight.exe`. Aviation Insight opens in its
own desktop window, with no terminal window or browser tab. Close the app window
to stop the local server. Opening it again focuses the existing window.

Works offline on Windows 10/11 x64. No Node.js installation, administrator
rights, or cloud account is required on the computer running it.

The administrator username is `admin`. The password generated on first run is in
`AviationInsight-data/First-run-login.txt`. Use **File → Open first-run login details**
to view it. Keep this file private; you can change the password in Admin and delete
it afterward. **File → Open data folder** opens the local data directory.

Upload `.xlsx` or macro-enabled `.xlsm` workbooks under **Admin → Manual Excel update**.
Date filters accept keyboard entry; press Enter or Tab to apply the complete date.
Existing accounts,
permissions, workbooks, reports, and settings from the console edition stay in
the same `AviationInsight-data` folder. Close the old console edition before
opening the desktop edition.

## Excel source files and cold start

The desktop app loads its workbooks automatically before showing the login screen.
The canonical project folder is `data/dashboard-sources`, containing `AMOS.xlsx`,
`AOG.xlsm`, `FAK.xlsx`, and `MARSHALING.xlsx`. Save and close your Excel workbook,
then close and reopen the app to reload changes. Opening a second window while
the app is already running is not a cold start.

Changed files are validated before import; identical files are not uploaded again.
Project files take precedence over manual uploads on the next startup. A missing
or invalid source workbook stops startup with details in `desktop.log`; previously
stored data is preserved. These workbooks are excluded from Git.

Use **File → Open Excel source folder** to open the active source folder. While
running from this project the app reads `data/dashboard-sources` directly. No
rebuild is needed after editing workbooks. Builds copy the files into
`dist/portable/dashboard-sources`; when moved away from the project, the app reads
that folder instead. `AVIATION_SOURCE_DIR` can explicitly select another folder.

## Move or back up

Keep the **entire `dist/portable` folder together**. Electron needs `resources`,
`locales`, DLLs, and the other files beside the EXE. Copying only the EXE will not work.

Close the app before copying or backing up. Copy the whole folder, including
`AviationInsight-data`, to another writable location to retain accounts and uploads.
Back up `AviationInsight-data` separately if you only need the data.
Rebuilding replaces application files and preserves the data directory.

Old extracted console runtimes may remain in `AviationInsight-data/runtime`;
the desktop edition uses `resources/app/runtime`.

## Offline behavior

Login, account management, dashboards, Excel uploads, downloads, and local
report rendering work offline. An administrator can reset employee passwords in Admin.
Fonts and application assets are bundled. Exports are rendered by the Electron window.

The backend listens only on `127.0.0.1`, choosing an available port each run.
The desktop window loads this local interface. Renderer Node.js access is disabled;
context isolation and sandboxing are enabled. External navigation, popups, and
network requests are blocked. Downloads use the native save dialog.

## Rebuild

On a Windows x64 build computer, install Node.js 24+, then prepare dependencies:

```powershell
npm.cmd ci
node -p "require('electron')"
```

These preparation steps need internet unless the runtimes are cached. Close
Aviation Insight, then double-click **Build-Portable.cmd** or run:

```powershell
npm.cmd run build:desktop
```

`npm.cmd run build:portable` builds the same Electron desktop edition. Output:
`dist/portable/AviationInsight.exe` with its companion files, `README.md`, and
`SHA256.txt`. Rebuild after source changes. The builder uses installed runtimes
and excludes project environment files, live accounts, databases, and credentials
from the application bundle. Existing local data stays beside the app.

Verify the build with:

```powershell
npm.cmd run test:portable
```

Tests use isolated data under `artifacts`. They check the Electron window, login,
dashboard rendering, restart, shutdown, Excel uploads, data persistence, and the
development browser checks.

This executable is unsigned; Windows may ask whether to run it.

## Diagnostics

Startup and server messages are recorded in `AviationInsight-data/desktop.log`.
Native Electron diagnostics are in `AviationInsight-data/logs/electron.log`, and
crash dumps stay in `AviationInsight-data/logs/crashes`. Reports are kept locally;
the app does not upload them. The build grants sandbox read access to application
assets without changing the permissions of `AviationInsight-data`.
