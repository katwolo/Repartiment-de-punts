# Repartiment de Punts

Eina de coevaluació entre iguals per a grups de treball. Permet que professors i alumnes gestionin grups, tasques i avaluacions mútues de forma anònima, amb tres mètodes de valoració diferents.

---

## Arquitectura

| Component | Ubicació |
|---|---|
| **Backend** (`Code.gs`) | Projecte Google Apps Script (container-bound al Sheets) |
| **Frontend** (`index.html`) | Repositori GitHub (servit via `UrlFetchApp` en cada petició) |
| **Base de dades** | Google Sheets vinculat al projecte d'Apps Script |

El `doGet()` de Apps Script busca el `index.html` directament des de GitHub, de manera que qualsevol canvi al repositori es reflecteix a la web sense necessitat de redesplegar.

---

## Rols d'usuari

| Rol | Capacitats |
|---|---|
| **Admin** | Gestió completa d'usuaris i grups de tot el centre |
| **Professor** | Crea i gestiona els seus grups, activa avaluacions, publica resultats |
| **Alumne** | Consulta les tasques del seu grup, participa al xat i envia avaluacions |

---

## Tres mètodes d'avaluació

### M1 · Borsa de Punts
El professor introdueix una nota base (0–10). La borsa total és `nota × nombre d'integrants`. Cada alumne reparteix lliurement aquests punts entre els companys (sense poder puntuar-se a si mateix) segons la seva contribució al treball.

### M2 · Tasques / Àgil
L'avaluació es basa en les tasques assignades al grup. Cada tasca té punts i un estat (`pendent`, `parcial`, `fet`). El sistema calcula automàticament la nota individual de cada alumne a partir dels punts de les tasques completades.

### M3 · Rúbrica (matriu de coeficients)
Cada alumne assigna un multiplicador (ex. 0.8, 1.0, 1.2) a cadascun dels seus companys. El professor aplica la mitjana dels coeficients rebuts a la nota del grup per obtenir la nota individual.

---

## Flux d'ús

### Per al professor
1. Inicia sessió i accedeix al tauler.
2. Crea un grup, afegeix membres i assigna tasques (opcionals).
3. Selecciona el mètode d'avaluació i introdueix la nota base del grup.
4. Activa l'avaluació — els alumnes reben accés al formulari.
5. Quan tots han votat, publica els resultats des del tauler.

### Per a l'alumne
1. Inicia sessió i accedeix al seu grup.
2. Consulta les tasques assignades i l'estat del grup.
3. Participa al xat de grup.
4. Quan l'avaluació és activa, completa el formulari de valoració dels companys.
5. Un cop publicats, consulta els resultats finals.

---

## Emmagatzematge de dades

Tota la informació es guarda al Google Sheets vinculat. Les pestanyes es creen automàticament en el primer accés:

| Pestanya | Columnes | Contingut |
|---|---|---|
| **Users** | id, name, email, pass, role, classe | Usuaris registrats |
| **Groups** | id, name, subject, teacherId, coordinatorId, memberIds, grade, method, evalActive, resultsPublished | Grups de treball |
| **Tasks** | id, groupId, title, desc, points, assignedTo, status | Tasques individuals |
| **Messages** | groupId, userId, text, ts | Missatges del xat de grup |
| **Evaluations** | groupId, method, evaluatorId, payload | Avaluacions (un registre per avaluador) |

---

## Desplegament

1. Crea un Google Sheets nou (les pestanyes es generen soles).
2. Obre **Extensions > Apps Script** i substitueix el `Code.gs` pel del repositori.
3. A **Implementa > Nova implementació**:
   - Tipus: Aplicació web
   - Executa com a: Jo
   - Qui hi té accés: Qualsevol
4. Copia la URL de la web app i comparteix-la amb els usuaris.

> Les dades de demostració es poden restaurar en qualsevol moment des del menú **Repartiment de punts > Restaurar dades de demostració** dins del Sheets.
