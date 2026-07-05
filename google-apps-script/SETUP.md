# Google Sheets setup for Pre/Post Test data

Follow these steps once. After that, every student who plays via your GitHub link will send one row to your spreadsheet.

## 1. Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Name it e.g. **Code of Life — Survey Responses**.

## 2. Add the script

1. In the sheet: **Extensions → Apps Script**.
2. Delete any default code and paste the contents of `Code.gs` from this folder.
3. Save the project (name it e.g. **Code of Life Survey**).
4. Run **`setupSheet`** once from the editor (Run ▶). Approve permissions when asked.
5. Check your sheet — you should see a **Responses** tab with column headers.

## 3. Deploy as web app

1. **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** (required so students can submit without signing in).
5. Click **Deploy** and copy the **Web app URL**.

## 4. Connect the game

1. Open `desktop/survey.js` in this repo.
2. Paste your URL into:

   ```javascript
   const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/....../exec";
   ```

3. Commit and push to GitHub (or test locally first).

## 5. Test

1. Open the desktop game, complete pre-test, play, complete post-test, submit.
2. Refresh your Google Sheet — a new row should appear.

## Column reference

| Column | Content |
|--------|---------|
| timestamp | When post-test was submitted |
| sessionId | Links pre + post for one play session |
| name | Student name or Anonymous |
| preQ1–preQ3 | Pre-test answers (A/B/C) |
| postQ1–postQ3 | Post-test answers (A/B/C) |
| score | Final game score |
| timeSeconds | Time played (seconds) |
| won | `true` if they created an Organism |

## Notes

- Students need internet when they **submit** the post-test.
- If `GOOGLE_SHEETS_URL` is empty, the game still works but data is not sent (check browser console).
- Re-deploy the web app after editing `Code.gs`.
