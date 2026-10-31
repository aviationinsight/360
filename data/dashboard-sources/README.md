# Dashboard source workbooks

These files are the source of truth for the desktop edition:

| Dashboard | Workbook |
| --- | --- |
| AMOS | `amos.xlsx` |
| AOG Delivery | `aog.xlsm` |
| FAK | `fak.xlsx` |
| Marshaling | `marshaling.xlsx` |

Edit or replace these files, keep their names, save and close Excel, then close
and reopen Aviation Insight. Startup validates all changed files before loading
them into local storage. Unchanged files are checked but not uploaded again.
Manual uploads are temporary overrides until the next cold start.

The workbooks were moved from OneDrive without editing their contents. Binary
workbooks are excluded from Git. Back up this folder with your project.

When run from `dist/portable`, the app reads this project folder directly; no
rebuild is required after workbook edits. The builder also copies the four files
to `dist/portable/dashboard-sources` for use when moving the app elsewhere.
That standalone copy becomes the source folder when the project folder is absent.
Use **File → Open Excel source folder** to open the active folder.
