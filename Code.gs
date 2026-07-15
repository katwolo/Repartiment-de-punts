/*****************************************************************
 * REPARTIMENT DE PUNTS · Backend (Google Apps Script)
 * API JSON — servida des de GitHub Pages
 *
 * Pestanyes que crea automàticament:
 *   Users · Groups · Tasks · Messages · Evaluations
 *
 * Desplegament:  Implementa > Nova implementació > Aplicació web
 *   - Executa com a: Jo (l'amo de la full)
 *   - Qui hi té accés: Qualsevol, fins i tot anònims
 *****************************************************************/

// Posa aquí l'ID del full de càlcul per usar-ne un de diferent al que conté l'script.
// Deixa-ho buit ('') per usar sempre el full actiu (comportament per defecte).
const SHEET_ID = '';

const HEADERS = {
  Users:        ['id','name','email','pass','role','classe'],
  Groups:       ['id','name','subject','teacherId','coordinatorId','memberIds','grade','method','evalActive','resultsPublished'],
  Tasks:        ['id','groupId','title','desc','points','assignedTo','status'],
  Messages:     ['groupId','userId','text','ts'],
  Evaluations:  ['groupId','method','evaluatorId','payload']
};

function ss(){ return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function jsonOut(data){
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- GET: accions de lectura ---------- */
function doGet(e){
  try {
    setupSheets();
    const action = e && e.parameter && e.parameter.action;
    if(action === 'loadState')  return jsonOut(loadState());
    if(action === 'resetDemo')  return jsonOut(resetDemo());
    return jsonOut({ ok: true, msg: 'API de Repartiment de Punts' });
  } catch(err){
    return jsonOut({ error: err.message });
  }
}

/* ---------- POST: accions d'escriptura ---------- */
function doPost(e){
  try {
    setupSheets();
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    if(action === 'saveStateBulk')   return jsonOut(saveStateBulk(body.stateJson));
    if(action === 'submitEvaluation') return jsonOut(submitEvaluation(body.groupId, body.method, body.evaluatorId, body.payloadJson));
    if(action === 'postMessage')      return jsonOut(postMessage(body.groupId, body.userId, body.text));
    return jsonOut({ error: 'Acció desconeguda: ' + action });
  } catch(err){
    return jsonOut({ error: err.message });
  }
}

/* ---------- Utilitats de fulls ---------- */
function getSheet(name){
  let sh = ss().getSheetByName(name);
  if(!sh){
    sh = ss().insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
    return sh;
  }
  const head = HEADERS[name];
  const current = sh.getRange(1,1,1,head.length).getValues()[0];
  let diff = false;
  for(var i=0;i<head.length;i++){ if(String(current[i]) !== head[i]){ diff = true; break; } }
  if(diff){ sh.getRange(1,1,1,head.length).setValues([head]); sh.setFrozenRows(1); }
  return sh;
}

function setupSheets(){
  Object.keys(HEADERS).forEach(getSheet);
  if(getSheet('Users').getLastRow() < 2) seedData();
}

function readSheet(name){
  const sh = getSheet(name);
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];
  const head = values[0];
  return values.slice(1).map(function(row){
    const o = {};
    head.forEach(function(h,i){ o[h] = row[i]; });
    return o;
  });
}

function writeSheet(name, rows){
  const sh = getSheet(name);
  const head = HEADERS[name];
  if(sh.getLastRow() > 1){
    sh.getRange(2,1, sh.getLastRow()-1, head.length).clearContent();
  }
  if(!rows.length) return;
  const data = rows.map(function(o){
    return head.map(function(h){
      const v = o[h];
      return (v === undefined || v === null) ? '' : v;
    });
  });
  sh.getRange(2,1, data.length, head.length).setValues(data);
}

/* ---------- LECTURA: muntar l'estat ---------- */
function loadState(){
  setupSheets();

  const users = readSheet('Users').map(function(u){
    return { id:String(u.id), name:String(u.name), email:String(u.email), pass:String(u.pass), role:String(u.role), classe:String(u.classe || '') };
  });

  const groups = readSheet('Groups').map(function(g){
    return {
      id: String(g.id),
      name: String(g.name),
      subject: String(g.subject),
      teacherId: String(g.teacherId),
      coordinatorId: g.coordinatorId ? String(g.coordinatorId) : null,
      memberIds: String(g.memberIds || '').split(',').map(function(s){return s.trim();}).filter(Boolean),
      grade: (g.grade === '' || g.grade === null) ? null : Number(g.grade),
      method: (g.method === '' || g.method === null) ? null : Number(g.method),
      evalActive: (g.evalActive === true || String(g.evalActive).toUpperCase() === 'TRUE'),
      resultsPublished: (g.resultsPublished === true || String(g.resultsPublished).toUpperCase() === 'TRUE'),
      tasks: [], messages: [], evalData: { m1:{}, m3:{} }
    };
  });
  const byId = {};
  groups.forEach(function(g){ byId[g.id] = g; });

  readSheet('Tasks').forEach(function(t){
    const g = byId[String(t.groupId)];
    if(!g) return;
    g.tasks.push({
      id:String(t.id), title:String(t.title), desc:String(t.desc || ''),
      points:Number(t.points) || 0, assignedTo: t.assignedTo ? String(t.assignedTo) : null,
      status:String(t.status || 'pending')
    });
  });

  readSheet('Messages').forEach(function(m){
    const g = byId[String(m.groupId)];
    if(!g) return;
    g.messages.push({ userId:String(m.userId), text:String(m.text), ts:Number(m.ts) || 0 });
  });
  groups.forEach(function(g){ g.messages.sort(function(a,b){ return a.ts - b.ts; }); });

  readSheet('Evaluations').forEach(function(e){
    const g = byId[String(e.groupId)];
    if(!g) return;
    const method = Number(e.method);
    let payload = {};
    try { payload = JSON.parse(e.payload); } catch(x){ payload = {}; }
    g.evalData[ method === 3 ? 'm3' : 'm1' ][ String(e.evaluatorId) ] = payload;
  });

  return { users: users, groups: groups };
}

/* ---------- ESCRIPTURA en bloc ---------- */
function saveStateBulk(stateJson){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const st = JSON.parse(stateJson);

    writeSheet('Users', (st.users || []).map(function(u){
      return { id:u.id, name:u.name, email:u.email, pass:u.pass, role:u.role, classe:u.classe || '' };
    }));

    writeSheet('Groups', (st.groups || []).map(function(g){
      return {
        id:g.id, name:g.name, subject:g.subject, teacherId:g.teacherId,
        coordinatorId: g.coordinatorId || '',
        memberIds: (g.memberIds || []).join(','),
        grade: (g.grade == null) ? '' : g.grade,
        method: (g.method == null) ? '' : g.method,
        evalActive: !!g.evalActive,
        resultsPublished: !!g.resultsPublished
      };
    }));

    const tasks = [];
    (st.groups || []).forEach(function(g){
      (g.tasks || []).forEach(function(t){
        tasks.push({ id:t.id, groupId:g.id, title:t.title, desc:t.desc || '',
                     points:t.points, assignedTo:t.assignedTo || '', status:t.status });
      });
    });
    writeSheet('Tasks', tasks);

    pruneOrphans((st.groups || []).map(function(g){ return String(g.id); }));

    return loadState();
  } finally {
    lock.releaseLock();
  }
}

function pruneOrphans(validIds){
  const valid = {};
  validIds.forEach(function(id){ valid[String(id)] = true; });
  ['Messages','Evaluations'].forEach(function(name){
    const kept = readSheet(name).filter(function(r){ return valid[String(r.groupId)]; });
    writeSheet(name, kept);
  });
}

/* ---------- ESCRIPTURA granular: un sol vot ---------- */
function submitEvaluation(groupId, method, evaluatorId, payloadJson){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const rows = readSheet('Evaluations').filter(function(r){
      return !(String(r.groupId) === String(groupId)
            && String(r.evaluatorId) === String(evaluatorId)
            && Number(r.method) === Number(method));
    });
    rows.push({ groupId:groupId, method:method, evaluatorId:evaluatorId, payload:payloadJson });
    writeSheet('Evaluations', rows);
    return loadState();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- ESCRIPTURA granular: un missatge de xat ---------- */
function postMessage(groupId, userId, text){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    getSheet('Messages').appendRow([groupId, userId, text, Date.now()]);
    return loadState();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Restaurar dades de demostració ---------- */
function resetDemo(){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    Object.keys(HEADERS).forEach(function(name){
      const sh = getSheet(name);
      if(sh.getLastRow() > 1) sh.getRange(2,1, sh.getLastRow()-1, HEADERS[name].length).clearContent();
    });
    seedData();
    return loadState();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Dades inicials ---------- */
function seedData(){
  const now = Date.now();

  writeSheet('Users', [
    { id:'u_admin', name:'Direcció Centre',   email:'admin@institut.cat', pass:'admin', role:'admin',   classe:'' },
    { id:'u_prof',  name:'Iván (Professor)',  email:'ivan@institut.cat',  pass:'prof',  role:'teacher', classe:'' },
    { id:'u_prof2', name:'Marta Roca',        email:'marta@institut.cat', pass:'prof',  role:'teacher', classe:'' },
    { id:'u_s1', name:'Anna Ferrer',  email:'anna@alumnes.cat',  pass:'1234', role:'student', classe:'A' },
    { id:'u_s2', name:'Bru Soler',    email:'bru@alumnes.cat',   pass:'1234', role:'student', classe:'A' },
    { id:'u_s3', name:'Carla Vidal',  email:'carla@alumnes.cat', pass:'1234', role:'student', classe:'A' },
    { id:'u_s4', name:'Dani Pons',    email:'dani@alumnes.cat',  pass:'1234', role:'student', classe:'A' },
    { id:'u_s5', name:'Èlia Mas',     email:'elia@alumnes.cat',  pass:'1234', role:'student', classe:'B' },
    { id:'u_s6', name:'Pol Roig',     email:'pol@alumnes.cat',   pass:'1234', role:'student', classe:'B' }
  ]);

  writeSheet('Groups', [
    { id:'g1', name:'Grup A · Investigació de mercat', subject:'Empresa i emprenedoria',
      teacherId:'u_prof', coordinatorId:'u_s1', memberIds:'u_s1,u_s2,u_s3,u_s4',
      grade:8, method:1, evalActive:true, resultsPublished:false },
    { id:'g2', name:'Grup B · Sessió d\'aquagym', subject:'Activitats aquàtiques',
      teacherId:'u_prof', coordinatorId:'u_s5', memberIds:'u_s5,u_s6',
      grade:'', method:'', evalActive:false, resultsPublished:false }
  ]);

  writeSheet('Tasks', [
    { id:'t1', groupId:'g1', title:'Dissenyar i llançar l\'enquesta', desc:'Crear el formulari i difondre\'l', points:35, assignedTo:'u_s1', status:'done' },
    { id:'t2', groupId:'g1', title:'Redactar el marc teòric',         desc:'Fonamentació de la recerca',     points:25, assignedTo:'u_s2', status:'done' },
    { id:'t3', groupId:'g1', title:'Analitzar dades i gràfics',       desc:'Tractament estadístic',          points:30, assignedTo:'u_s3', status:'partial' },
    { id:'t4', groupId:'g1', title:'Format, ortografia i conclusions',desc:'Revisió final',                  points:10, assignedTo:'u_s4', status:'pending' }
  ]);

  writeSheet('Messages', [
    { groupId:'g1', userId:'u_s1', text:'Hola equip! He activat la valoració amb el mètode del pressupost. Quan pugueu, repartiu els punts.', ts: now - 3600000 },
    { groupId:'g1', userId:'u_s2', text:'Fet! Bona feina amb l\'enquesta 👍', ts: now - 1800000 }
  ]);

  writeSheet('Evaluations', []);
}

/* ---------- Menú d'ajuda dins de la full ---------- */
function onOpen(){
  SpreadsheetApp.getUi()
    .createMenu('Repartiment de punts')
    .addItem('Inicialitzar / crear pestanyes', 'setupSheets')
    .addItem('Restaurar dades de demostració', 'resetDemo')
    .addToMenu();
}
