/**
 * Code of Life — Pre/Post Test → Google Sheets
 *
 * Setup: see SETUP.md in this folder.
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Responses");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }

    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.sessionId || "",
      data.name || "Anonymous",
      data.preQ1 || "",
      data.preQ2 || "",
      data.preQ3 || "",
      data.postQ1 || "",
      data.postQ2 || "",
      data.postQ3 || "",
      data.score !== undefined ? data.score : "",
      data.timeSeconds !== undefined ? data.timeSeconds : "",
      data.won !== undefined ? data.won : "",
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Responses");
  if (!sheet) {
    sheet = ss.insertSheet("Responses");
  }
  sheet.clearContents();
  sheet.appendRow([
    "timestamp",
    "sessionId",
    "name",
    "preQ1",
    "preQ2",
    "preQ3",
    "postQ1",
    "postQ2",
    "postQ3",
    "score",
    "timeSeconds",
    "won",
  ]);
  sheet.setFrozenRows(1);
}
