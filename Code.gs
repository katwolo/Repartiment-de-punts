// REPARTIMENT DE PUNTS — Servidor Apps Script
// Gestiona sessions de coevaluació i emmagatzema dades al Google Sheets vinculat.

// ---------------------------------------------------------------------------
// SYNC — actualitza el codi des del repositori GitHub (repo públic)
// Executa aquesta funció des de l'editor d'Apps Script per sincronitzar.
// ---------------------------------------------------------------------------
function updateFromGitHub() {
  const BRANCH = 'claude/app-script-code-from-url-9tu03y';
  const RAW    = 'https://raw.githubusercontent.com/katwolo/Repartiment-de-punts/' + BRANCH + '/';

  const files = [
    { name: 'appsscript', type: 'json',     source: UrlFetchApp.fetch(RAW + 'appsscript.json').getContentText() },
    { name: 'Code',       type: 'server_js', source: UrlFetchApp.fetch(RAW + 'Code.gs').getContentText() },
    { name: 'index',      type: 'html',      source: UrlFetchApp.fetch(RAW + 'index.html').getContentText() }
  ];

  const response = UrlFetchApp.fetch(
    'https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId() + '/content',
    {
      method: 'put',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ files: files }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Error sincronitzant: ' + response.getContentText());
  }

  Logger.log('✓ Codi actualitzat correctament des de GitHub!');
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Repartidor de Puntos - Coevaluación')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------------------------------------------------------------------------
// PLANTILLA — crea des de zero totes les fulles del model V1
// ---------------------------------------------------------------------------
function plantillaSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function getOrCreate(name) {
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  // Web — URL pública del web app
  const webSheet = getOrCreate('Web');
  webSheet.clearContents();
  webSheet.appendRow(['url', ScriptApp.getService().getUrl()]);

  // Users
  const usersSheet = getOrCreate('Users');
  usersSheet.clearContents();
  usersSheet.appendRow(['id', 'name', 'email', 'pass', 'role', 'classe']);
  usersSheet.appendRow(['u_admin', 'Administrador', 'admin@centre.cat', 1234, 'admin', '']);

  // Groups
  const groupsSheet = getOrCreate('Groups');
  groupsSheet.clearContents();
  groupsSheet.appendRow([
    'id', 'name', 'subject', 'teacherId', 'coordinatorId',
    'memberIds', 'grade', 'method', 'evalActive', 'resultsPublished'
  ]);

  // Tasks
  const tasksSheet = getOrCreate('Tasks');
  tasksSheet.clearContents();
  tasksSheet.appendRow(['id', 'groupId', 'title', 'desc', 'points', 'assignedTo', 'status']);

  // Messages
  const messagesSheet = getOrCreate('Messages');
  messagesSheet.clearContents();
  messagesSheet.appendRow(['groupId', 'userId', 'text', 'ts']);

  // Evaluations
  const evaluationsSheet = getOrCreate('Evaluations');
  evaluationsSheet.clearContents();
  evaluationsSheet.appendRow(['groupId', 'method', 'evaluatorId', 'payload']);

  // Sessions i Respuestas per al flux actual de votació
  setupSheets();

  return 'Plantilla V1 creada correctament. Totes les fulles estan llestes.';
}

// ---------------------------------------------------------------------------
// SETUP — crea Sessions i Respuestas si no existeixen
// ---------------------------------------------------------------------------
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Sessions')) {
    ss.insertSheet('Sessions')
      .appendRow(['ID', 'Modo', 'Profesor', 'Nota_Base', 'Integrantes', 'Creado']);
  }
  if (!ss.getSheetByName('Respuestas')) {
    ss.insertSheet('Respuestas')
      .appendRow(['ID_Sesion', 'Votante', 'Puntuaciones', 'Justificacion', 'Timestamp']);
  }
}

// ---------------------------------------------------------------------------
// SESSIONS
// ---------------------------------------------------------------------------
function createNewSession(data) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sessions');

  // Utilities.getUuid() garanteix unicitat (V8 runtime)
  const id = Utilities.getUuid().substring(0, 8);

  sheet.appendRow([
    id,
    data.mode,
    data.profEmail,
    data.baseGrade || 0,
    JSON.stringify(data.members),
    new Date()
  ]);

  const url = ScriptApp.getService().getUrl();
  data.members.forEach(function(member) {
    if (member.email) {
      try {
        MailApp.sendEmail({
          to: member.email,
          subject: 'Acceso a Coevaluación: ' + id,
          htmlBody:
            'Hola ' + member.name + ',<br><br>' +
            'El teu equip ha iniciat una sessió de coevaluació (<b>' + data.mode + '</b>).<br><br>' +
            'Entra aquí: <a href="' + url + '">' + url + '</a><br>' +
            'Codi de sessió: <b>' + id + '</b>'
        });
      } catch (err) {
        console.error('Error enviant email a ' + member.email + ': ' + err.message);
      }
    }
  });

  return { id: id, members: data.members, mode: data.mode, baseGrade: data.baseGrade };
}

function getSessionData(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sessionsSheet = ss.getSheetByName('Sessions');
  if (!sessionsSheet) return null;

  const sessions = sessionsSheet.getDataRange().getValues();
  for (var i = 1; i < sessions.length; i++) {
    if (String(sessions[i][0]) === String(id)) {
      return {
        id:        sessions[i][0],
        mode:      sessions[i][1],
        profEmail: sessions[i][2],
        baseGrade: sessions[i][3],
        members:   JSON.parse(sessions[i][4])
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// VOTES
// ---------------------------------------------------------------------------
function submitUserVote(voteData) {
  // Assegura que les fulles existeixen abans d'accedir-hi
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const respSheet = ss.getSheetByName('Respuestas');

  // Comprova duplicats (s'omite la fila de capçalera, índex 0)
  const responses = respSheet.getDataRange().getValues();
  for (var i = 1; i < responses.length; i++) {
    if (String(responses[i][0]) === String(voteData.sessionId) &&
        responses[i][1] === voteData.voterName) {
      throw new Error('Ja has votat en aquesta sessió.');
    }
  }

  respSheet.appendRow([
    voteData.sessionId,
    voteData.voterName,
    JSON.stringify(voteData.scores),
    voteData.justification || '',
    new Date()
  ]);

  checkAndSendProfessorReport(voteData.sessionId);
  return true;
}

function checkAndSendProfessorReport(sessionId) {
  const session = getSessionData(sessionId);
  if (!session) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const respSheet = ss.getSheetByName('Respuestas');
  if (!respSheet) return;

  // slice(1) elimina la fila de capçalera abans de filtrar
  const allRows = respSheet.getDataRange().getValues();
  const sessionVotes = allRows.slice(1).filter(function(r) {
    return String(r[0]) === String(sessionId);
  });

  if (sessionVotes.length === session.members.length) {
    var rows = sessionVotes.map(function(v) {
      return '<tr><td>' + v[1] + '</td><td>' + v[2] + '</td><td>' + v[3] + '</td></tr>';
    }).join('');

    var reportHtml =
      '<h2>Informe de Coevaluació — Sessió ' + sessionId + '</h2>' +
      '<p>Mètode: <b>' + session.mode + '</b> | Nota Base: <b>' + session.baseGrade + '</b></p>' +
      '<table border="1" style="border-collapse:collapse;width:100%">' +
      '<tr><th>Votant</th><th>Puntuacions</th><th>Comentari</th></tr>' +
      rows +
      '</table>' +
      '<p>Consulta les dades completes al teu Google Sheet.</p>';

    MailApp.sendEmail({
      to: session.profEmail,
      subject: 'RESULTATS FINALS — Sessió ' + sessionId,
      htmlBody: reportHtml
    });
  }
}
