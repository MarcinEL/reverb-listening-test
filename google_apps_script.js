/**
 * ═══════════════════════════════════════════════════════════════
 *  Google Apps Script — Zbieranie wyników testów słuchowych
 * ═══════════════════════════════════════════════════════════════
 *
 * Obsługuje dwa typy testów:
 *   1. MUSHRA (listening_test.html)
 *   2. AB / ABX / Preferencja (listening_test_ab.html)
 *
 * INSTRUKCJA WDROŻENIA:
 *
 * 1. Otwórz Google Sheets → Rozszerzenia → Apps Script
 * 2. Wklej ten kod i zapisz
 * 3. Kliknij "Wdróż" → "Nowe wdrożenie"
 * 4. Typ: "Aplikacja internetowa"
 * 5. Wykonywanie jako: "Ja" (Twoje konto)
 * 6. Kto ma dostęp: "Każdy"
 * 7. Skopiuj URL wdrożenia i wklej do konfiguracji obu testów
 *
 * Arkusz automatycznie:
 * - Tworzy osobne zakładki dla MUSHRA i AB/ABX/Preference
 * - Tworzy nagłówki przy pierwszym żądaniu
 * - Dodaje nowe wiersze z wynikami każdego uczestnika
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Wykryj typ testu
    const testType = data.test_type || 'mushra';

    if (testType === 'mushra') {
      handleMushra(ss, data);
    } else {
      handleAbAbxPreference(ss, data);
    }

    const resultCount = (data.results || []).length;
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', test_type: testType, rows: resultCount }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Obsługa wyników MUSHRA
 */
function handleMushra(ss, data) {
  let sheet = ss.getSheetByName('MUSHRA');
  if (!sheet) {
    sheet = ss.insertSheet('MUSHRA');
  }

  // Nagłówki
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'timestamp',
      'participant_id',
      'experience',
      'headphones',
      'notes',
      'scenario',
      'sample_id',
      'sample_label',
      'score',
      'config_title'
    ]);
    formatHeaders(sheet, 10);
  }

  const participant = data.participant || {};
  const results = data.results || [];
  const configTitle = data.config_title || '';

  results.forEach(function (result) {
    sheet.appendRow([
      new Date().toISOString(),
      result.participant_id || participant.id || '',
      result.experience || participant.experience || '',
      participant.headphones || '',
      participant.notes || '',
      result.scenario || '',
      result.sample_id || '',
      result.sample_label || '',
      result.score || 0,
      configTitle
    ]);
  });

  sheet.autoResizeColumns(1, 10);
}

/**
 * Obsługa wyników AB / ABX / Preferencja
 */
function handleAbAbxPreference(ss, data) {
  const testType = data.test_type || 'ab';
  const sheetName = testType.toUpperCase();

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Nagłówki
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'timestamp',
      'participant_id',
      'experience',
      'headphones',
      'test_type',
      'trial_name',
      'trial_description',
      'sample_a_id',
      'sample_b_id',
      'choice',
      'x_is',
      'is_correct',
      'reaction_time_ms',
      'config_title'
    ]);
    formatHeaders(sheet, 14);
  }

  const participant = data.participant || {};
  const results = data.results || [];
  const configTitle = data.config_title || '';

  results.forEach(function (result) {
    sheet.appendRow([
      new Date().toISOString(),
      result.participant_id || participant.id || '',
      result.experience || participant.experience || '',
      result.headphones || participant.headphones || '',
      result.test_type || testType,
      result.trial_name || '',
      result.trial_description || '',
      result.sample_a_id || '',
      result.sample_b_id || '',
      result.choice || '',
      result.x_is || '',
      result.is_correct || '',
      result.reaction_time_ms || 0,
      configTitle
    ]);
  });

  sheet.autoResizeColumns(1, 14);
}

/**
 * Formatowanie nagłówków
 */
function formatHeaders(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1B3A5C');
  headerRange.setFontColor('#FFFFFF');
}

// Obsługa żądań GET (do testowania)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Listening test results collector is running. Supports MUSHRA, AB, ABX, and Preference tests. Send POST to submit results.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
