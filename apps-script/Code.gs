/**
 * Приём анкет со свадебного сайта.
 * Каждый ответ записывается строкой в лист "Ответы" и приходит сообщением в Telegram.
 * Как подключить - см. README.md, раздел "Анкета".
 */

const SHEET_NAME = 'Ответы';
const HEADERS = ['Время', 'Имя и фамилия', 'Ответ', 'Горячее', 'Напитки',
                 'Аллергии', 'Песня', 'Пожелание', 'Приглашение', 'Язык'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    getSheet_().appendRow([
      new Date(), clean_(p.name), clean_(p.attending), clean_(p.entree),
      clean_(p.drinks), clean_(p.allergies), clean_(p.song), clean_(p.wish), clean_(p.invite), clean_(p.lang)
    ]);
  } finally {
    lock.releaseLock();
  }
  try {
    notify_(p);
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Анкета работает');
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

// Обрезает слишком длинный текст и не даёт гостю вписать формулу в таблицу.
function clean_(v) {
  v = String(v || '').trim().slice(0, 500);
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v;
}

function notify_(p) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TG_TOKEN');
  const chats = (props.getProperty('TG_CHAT_IDS') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!token || !chats.length) return;

  const yes = p.attending === 'Придёт';
  const lines = [
    (yes ? '✅ ' : '❌ ') + (p.name || 'Без имени'),
    'Ответ: ' + (p.attending || '-')
  ];
  if (yes) {
    lines.push('Горячее: ' + (p.entree || '-'));
    if (p.drinks) lines.push('Напитки: ' + p.drinks);
    if (p.allergies) lines.push('Аллергии: ' + p.allergies);
    if (p.song) lines.push('Песня: ' + p.song);
  } else if (p.wish) {
    lines.push('Пожелание: ' + p.wish);
  }
  if (p.invite) lines.push('Приглашение: ' + p.invite);

  chats.forEach(id => {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      payload: { chat_id: id, text: lines.join('\n') },
      muteHttpExceptions: true
    });
  });
}

/**
 * Запустите один раз, после того как вы оба написали боту /start.
 * В журнале выполнения появятся chat_id - их нужно вписать в свойство TG_CHAT_IDS через запятую.
 */
function showChatIds() {
  const token = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  const res = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates').getContentText());
  const seen = {};
  (res.result || []).forEach(u => {
    const m = u.message || u.my_chat_member;
    if (m && m.chat) seen[m.chat.id] = [m.chat.first_name, m.chat.last_name, m.chat.username && '@' + m.chat.username].filter(Boolean).join(' ');
  });
  console.log(JSON.stringify(seen, null, 2));
}

/** Пробный ответ: добавит строку в таблицу и пришлёт сообщение в Telegram. */
function testRsvp() {
  doPost({ parameter: { name: 'Тестовый Гость', attending: 'Придёт', entree: 'Рыба',
                        drinks: 'Игристое', song: 'ABBA - Dancing Queen', lang: 'ru' } });
}
