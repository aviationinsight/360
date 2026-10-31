# Aviation Insight desktop

Offline Windows x64 application built with Electron, React, Hono, and local SQLite.

## Run

Open `dist/portable/AviationInsight.exe`. Keep the entire portable folder together.
Accounts, uploads and settings remain in `AviationInsight-data`.

## Excel sources

The authoritative workbooks are in `data/dashboard-sources`: `AMOS.xlsx`,
`AOG.xlsm`, `FAK.xlsx`, and `MARSHALING.xlsx`. Save changes, close the app fully,
then reopen it to import updates automatically. Unchanged files are skipped.

## Build and verify

On Windows with Node.js 24+, run `npm.cmd ci` and `node -p "require('electron')"`
once to prepare the build computer. Then run `npm.cmd run build:desktop` or
double-click `Build-Portable.cmd`. The app itself runs without Node.js or internet.

Run `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run test:portable`.
Browser tests need the development browser installed once with
`npx.cmd playwright install chromium --only-shell`. Electron supplies the app window
and renders exported images locally.

See [desktop instructions](docs/PORTABLE.md), [local API](docs/API.md), and
[Excel source folder](data/dashboard-sources/README.md).

SQLite migrations under `database/migrations` are required to open existing accounts
and data. They are local database upgrades.
