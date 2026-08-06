# RaidX AKTU Copy Downloader

Downloads your evaluated AKTU answer script as a **single PDF** (or a ZIP of PNGs)
instead of clicking through it one page at a time.

## Install (Brave / Chrome / Edge)

1. Unzip this folder somewhere permanent — e.g. `~/Documents/raidx-aktu`.
   Deleting or moving the folder later uninstalls the extension.
2. Open `brave://extensions` (or `chrome://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. Pin it: puzzle-piece icon in the toolbar → pin **RaidX AKTU Copy Downloader**.

## Use

1. Log into aktuexams.in and open **View Answer Script** for a subject.
2. The panel appears automatically at the top-right once the page image loads.
   (If it doesn't, click the extension icon → **Show / hide panel**.)
3. **Test page 1** — one request, confirms the server honours page jumps.
4. **Fetch all pages** — pages are downloaded as they're fetched, because the
   server deletes each rendered image within seconds of generating it.
5. **Retry missing** if any page failed.
6. **Download PDF** (or ZIP).

## Notes

- Works only while you're logged in; the extension uses your existing session
  and never sees or stores your password.
- Nothing is uploaded anywhere. Pages are held in the tab's memory and written
  straight to your Downloads folder.
- Don't reload the tab between Fetch and Download — the images live in memory.
- ~36 pages ≈ 15–20 MB.

## How it works

The viewer is ASP.NET WebForms inside an iframe; the pager posts back and
reloads the page. Rather than clicking Next, the extension replays the
`TxtGoTo` / `BtnGoTo` postback with `fetch()` in the background, reads the
`ctl00_Ajaxmastercontentplaceholder_IMGAS` image URL out of each response, and
downloads it immediately. The PDF is assembled in-browser (JPEG/DCTDecode),
no external libraries.

Built for personal use — downloading your own answer scripts.
