# Repartiment de Punts

Eina de coevaluació entre iguals per a grups de treball. Permet que els alumnes es valorin mútuament de forma anònima i que el professor rebi un informe automàtic quan tots hagin votat.

---

## Funcionalitat

### Dos mètodes de valoració

**Borsa de Punts**
El professor introdueix una nota base (0–10). La borsa total és `nota × nombre d'integrants`. Els alumnes reparteixen lliurement aquests punts entre els companys segons la seva contribució.

**Coeficients**
Cada alumne assigna un multiplicador (ex. 0.8, 1.0, 1.2) a cadascun dels seus companys. El professor aplica aquests coeficients a la nota del grup per obtenir la nota individual de cada alumne.

---

### Flux d'ús

#### Per al professor
1. Selecciona el mètode de valoració (Borsa o Coeficients).
2. Introdueix el seu email i, en cas de Borsa, la nota base del grup.
3. Afegeix el nom i l'email de cada integrant del grup.
4. Prem **"Activar i Enviar Emails"**.
5. El sistema genera un codi de sessió únic i envia automàticament un email a cada alumne amb l'enllaç i el codi.
6. Quan tots els alumnes hagin votat, el professor rep per email un informe complet amb totes les valoracions.

#### Per a l'alumne
1. Obre l'enllaç rebut per email (o accedeix directament al web app).
2. Introdueix el codi de sessió.
3. Selecciona el seu nom a la llista.
4. Assigna una puntuació a cadascun dels seus companys.
5. Opcionalment, escriu una justificació.
6. Prem **"Confirmar Votació"**.

El sistema impedeix votar dues vegades amb el mateix nom a la mateixa sessió.

---

### Informe automàtic

Quan l'últim integrant del grup confirma la seva votació, el professor rep un email amb:
- El mètode utilitzat i la nota base
- Una taula amb totes les valoracions i comentaris
- Accés directe al Google Sheets amb les dades completes

---

## Emmagatzematge de dades

Tota la informació es guarda al Google Sheets vinculat:

| Full | Contingut |
|---|---|
| **Sessions** | Una fila per sessió: ID, mètode, email professor, nota base, integrants |
| **Respuestas** | Una fila per vot: ID sessió, votant, puntuacions (JSON), comentari |
| **Users** | Usuaris registrats amb rol (admin, teacher, student) |
| **Groups** | Grups de treball amb assignació de professor i mètode |
| **Tasks** | Tasques individuals amb punts i estat |
| **Messages** | Missatges de grup |
| **Evaluations** | Avaluacions del model V1 |
