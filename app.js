// === PWA REGISTRO ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW Registrado')).catch(err => console.log('SW Falló', err));
    });
}

// === CONSTANTES Y ESTADO ===
const M_CHEST = "Pecho", M_BACK = "Espalda", M_SHOULDER = "Hombros", M_QUADS = "Cuádriceps", M_HAMS = "Isquios", M_GLUTES = "Glúteos", M_BICEPS = "Bíceps", M_TRICEPS = "Tríceps", M_CALVES = "Gemelos", M_CORE = "Core", M_OTHER = "Otro";
const muscleOptions = [M_CHEST, M_BACK, M_SHOULDER, M_QUADS, M_HAMS, M_GLUTES, M_BICEPS, M_TRICEPS, M_CALVES, M_CORE, M_OTHER];

let baseRoutine = {};

// === INICIALIZACIÓN ===
window.onload = async function() {
    try {
        const response = await fetch('rutinas.json');
        if(response.ok) { baseRoutine = await response.json(); }
    } catch (e) { console.error("No se pudo cargar rutinas.json. Asegúrate de estar en un servidor local.", e); }

    populateDaySelector();
    populateBuilderDropdown();
    loadRoutineForEdit();
    initCalendar();
    window.scrollTo(0,0);
};

function getMergedRoutines() {
    const custom = JSON.parse(localStorage.getItem('custom_routines') || '{}');
    const hidden = JSON.parse(localStorage.getItem('hidden_routines') || '[]');
    let merged = JSON.parse(JSON.stringify(baseRoutine)); 
    Object.assign(merged, custom);
    hidden.forEach(id => { delete merged[id]; });
    return merged;
}

function switchTab(tab) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${tab}`).classList.add('active');
    document.getElementById(`btn-${tab}`).classList.add('active');
    window.scrollTo(0,0);

    if(tab === 'train') populateDaySelector();
    if(tab === 'build') populateBuilderDropdown();
    if(tab === 'stats') {
        populateStatsDropdown(); renderHabitsStats(); renderMuscleStats(); renderCalendar();
    }
}

// === ENTRENAR ===
function populateDaySelector() {
    const selector = document.getElementById('day-selector');
    const currentVal = selector.value;
    selector.innerHTML = '<option value="">-- Selecciona Entrenamiento --</option><option value="CARDIO">🏃 Registrar Cardio</option>';
    const routines = getMergedRoutines();
    for (const key in routines) {
        const opt = document.createElement('option'); opt.value = key; opt.textContent = routines[key].title; selector.appendChild(opt);
    }
    if (currentVal === 'CARDIO' || routines[currentVal]) selector.value = currentVal; 
}

function loadDay() {
    const dayKey = document.getElementById('day-selector').value;
    const container = document.getElementById('workout-container');
    container.innerHTML = '';
    if (!dayKey) return;
    if (dayKey === 'CARDIO') { renderCardioForm(container); return; }

    const routines = getMergedRoutines();
    const dayData = routines[dayKey];
    const draft = JSON.parse(localStorage.getItem('draft_' + dayKey) || 'null');
    const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
    const lastWorkout = history.filter(w => w.dayId === dayKey && w.type !== 'cardio').pop();

    let html = ``;
    if (draft && draft.exercises && draft.exercises.length > 0) html += `<div style="text-align:center; font-size:0.8rem; color:var(--secondary-color); margin-bottom:10px;">Borrador recuperado</div>`;
    if(dayData.rule) html += `<div class="rule-box"><strong>Nota:</strong> ${dayData.rule}</div>`;
    html += `<div id="exercise-list">`;

    if (draft && draft.exercises && draft.exercises.length > 0) {
        draft.exercises.forEach((ex, index) => html += buildCardHTML(ex.id, ex.name, ex.target, ex.muscle, ex.sets, index + 1));
    } else {
        dayData.exercises.forEach((ex, index) => {
            let prefilledSets = [];
            for (let i = 0; i < ex.sets; i++) {
                let w = "", r = "";
                if (lastWorkout && lastWorkout.exercises && lastWorkout.exercises[ex.id] && lastWorkout.exercises[ex.id][i]) {
                    w = lastWorkout.exercises[ex.id][i].weight; r = lastWorkout.exercises[ex.id][i].reps;
                }
                prefilledSets.push({ weight: w, reps: r });
            }
            html += buildCardHTML(ex.id, ex.name, ex.target, ex.muscle, prefilledSets, index + 1);
        });
    }

    html += `</div><button class="btn-secondary" onclick="addExtraExercise('${dayKey}')">+ Ejercicio Extra (Puntual)</button><button class="btn-save" onclick="saveWorkout('${dayKey}')">Guardar Sesión</button>`;
    container.innerHTML = html;
}

function buildCardHTML(id, name, target, muscle, setsData, index = "*") {
    const safeMuscle = muscle || M_OTHER;
    let html = `<div class="card workout-card" id="ex-${id}" data-name="${name}" data-target="${target}" data-muscle="${safeMuscle}">
        <div class="card-header"><h3>${index}. ${name}</h3><span class="muscle-tag">${safeMuscle}</span></div>
        <div class="target-box">🎯 ${target}</div>
        <div class="sets-header"><div class="col-serie">Serie</div><div class="col-input">Kg / Extra</div><div class="col-input">Reps</div></div>
        <div class="sets-container">`;
    setsData.forEach((set, i) => {
        html += `<div class="set-row"><span><span class="set-num">${i + 1}</span></span><input type="number" inputmode="decimal" class="weight-input" placeholder="-" value="${set.weight}" oninput="autoSaveDraft()"><input type="number" inputmode="decimal" class="reps-input" placeholder="-" value="${set.reps}" oninput="autoSaveDraft()"></div>`;
    });
    html += `</div><button class="btn-add-set" onclick="addDynamicSet('${id}')">+ 1 Serie</button></div>`;
    return html;
}

function addDynamicSet(exId) {
    const card = document.getElementById('ex-' + exId);
    const setsContainer = card.querySelector('.sets-container');
    const currentSets = setsContainer.querySelectorAll('.set-row').length;
    const newSetHtml = `<div class="set-row" style="animation: fadeIn 0.3s ease;"><span><span class="set-num">${currentSets + 1}</span></span><input type="number" inputmode="decimal" class="weight-input" placeholder="-" value="" oninput="autoSaveDraft()"><input type="number" inputmode="decimal" class="reps-input" placeholder="-" value="" oninput="autoSaveDraft()"></div>`;
    setsContainer.insertAdjacentHTML('beforeend', newSetHtml);
    autoSaveDraft();
}

function addExtraExercise(dayKey) {
    const name = prompt("Nombre del ejercicio extra:"); if (!name) return;
    const numSets = parseInt(prompt("Número de series:", "3")) || 3;
    const target = prompt("Repeticiones objetivo:", "8-12 reps") || "Según sensaciones";
    const exId = 'extra_' + Date.now();
    let emptySets = Array(numSets).fill({ weight: "", reps: "" });
    const list = document.getElementById('exercise-list');
    const currentIndex = list.querySelectorAll('.workout-card').length + 1;
    const muscleChoice = prompt(`Grupo muscular (${muscleOptions.join(", ")}):`, M_OTHER);
    list.insertAdjacentHTML('beforeend', buildCardHTML(exId, name, target, muscleChoice, emptySets, currentIndex));
    autoSaveDraft();
}

function autoSaveDraft() {
    const dayKey = document.getElementById('day-selector').value;
    if(!dayKey || dayKey === 'CARDIO') return;
    const cards = document.querySelectorAll('.workout-card');
    const draftData = { exercises: [] };
    cards.forEach(card => {
        const exId = card.id.replace('ex-', '');
        const sets = [];
        card.querySelectorAll('.weight-input').forEach((wInput, i) => {
            const rInput = card.querySelectorAll('.reps-input')[i];
            sets.push({ weight: wInput.value, reps: rInput.value });
        });
        draftData.exercises.push({ id: exId, name: card.getAttribute('data-name'), target: card.getAttribute('data-target'), muscle: card.getAttribute('data-muscle'), sets: sets });
    });
    localStorage.setItem('draft_' + dayKey, JSON.stringify(draftData));
}

function saveWorkout(dayId) {
    const cards = document.querySelectorAll('.workout-card'); if(cards.length === 0) return;
    const workoutRecord = { date: new Date().toISOString(), dayId: dayId, type: 'strength', exercises: {}, exerciseMetadata: {} };
    cards.forEach(card => {
        const exId = card.id.replace('ex-', ''); const name = card.getAttribute('data-name'); const muscle = card.getAttribute('data-muscle');
        let setsData = [];
        card.querySelectorAll('.weight-input').forEach((wInput, i) => {
            const rInput = card.querySelectorAll('.reps-input')[i];
            setsData.push({ weight: wInput.value || "", reps: rInput.value || "" });
        });
        workoutRecord.exercises[exId] = setsData; workoutRecord.exerciseMetadata[exId] = { name: name, muscle: muscle };
    });
    const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
    history.push(workoutRecord); localStorage.setItem('workout_history', JSON.stringify(history)); localStorage.removeItem('draft_' + dayId);
    showToast("Entrenamiento guardado 🏆"); document.getElementById('day-selector').value = ""; document.getElementById('workout-container').innerHTML = ""; switchTab('stats');
}

// === CARDIO ===
function renderCardioForm(container) {
    container.innerHTML = `
    <div class="card" style="border: 1px solid rgba(249, 115, 22, 0.3);">
        <h3 style="color: var(--cardio-color); margin-bottom: 20px;">Registro de Cardio</h3>
        <label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">Modalidad</label>
        <select id="c-modality"><option value="Cinta de correr">Cinta de correr</option><option value="Bicicleta estática">Bicicleta estática / Ciclo</option><option value="Elíptica">Elíptica</option><option value="Tenis / Pista">Tenis / Pista</option><option value="Correr (Exterior)">Correr (Exterior)</option><option value="Otro">Otro</option></select>
        <div class="builder-flex"><div style="flex:1;"><label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">Tiempo (min)</label><input type="number" inputmode="decimal" id="c-duration" placeholder="Ej. 30"></div><div style="flex:1;"><label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">Distancia (Km)</label><input type="number" inputmode="decimal" id="c-distance" placeholder="Opcional"></div></div>
        <div class="builder-flex"><div style="flex:1;"><label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">Kcal</label><input type="number" inputmode="decimal" id="c-cal" placeholder="Opc."></div><div style="flex:1;"><label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">FC Media</label><input type="number" inputmode="decimal" id="c-fcmed" placeholder="Lpm"></div><div style="flex:1;"><label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">FC Max</label><input type="number" inputmode="decimal" id="c-fcmax" placeholder="Lpm"></div></div>
        <label style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px; display:block;">Notas</label><textarea id="c-notes" placeholder="Ej. Sensaciones..."></textarea>
        <button class="btn-save btn-save-cardio" onclick="saveCardio()">Guardar Sesión</button>
    </div>`;
}
function saveCardio() {
    const modality = document.getElementById('c-modality').value; const duration = document.getElementById('c-duration').value;
    if(!duration) { alert("Añade la duración"); return; }
    const record = { date: new Date().toISOString(), type: 'cardio', modality: modality, duration: duration, distance: document.getElementById('c-distance').value, cal: document.getElementById('c-cal').value, fcMed: document.getElementById('c-fcmed').value, fcMax: document.getElementById('c-fcmax').value, notes: document.getElementById('c-notes').value };
    const history = JSON.parse(localStorage.getItem('workout_history') || '[]'); history.push(record); localStorage.setItem('workout_history', JSON.stringify(history));
    showToast("Cardio guardado 🏃‍♂️"); document.getElementById('day-selector').value = ""; document.getElementById('workout-container').innerHTML = ""; switchTab('stats');
}

// === EDITOR ===
function populateBuilderDropdown() {
    const select = document.getElementById('routine-edit-select'); const currentVal = select.value;
    select.innerHTML = '<option value="NEW">+ Crear Nueva Rutina</option>';
    const routines = getMergedRoutines();
    for (const key in routines) { const opt = document.createElement('option'); opt.value = key; opt.textContent = "Editar: " + routines[key].title; select.appendChild(opt); }
    if (currentVal === 'NEW' || routines[currentVal]) select.value = currentVal; 
}
function loadRoutineForEdit() {
    const id = document.getElementById('routine-edit-select').value; document.getElementById('builder-exercises').innerHTML = '';
    if (id === 'NEW') { document.getElementById('new-routine-name').value = ''; document.getElementById('new-routine-rule').value = ''; document.getElementById('btn-delete-routine').style.display = 'none'; addBuilderExerciseRow(); return; }
    const routine = getMergedRoutines()[id];
    document.getElementById('new-routine-name').value = routine.title; document.getElementById('new-routine-rule').value = routine.rule || ''; document.getElementById('btn-delete-routine').style.display = 'block';
    routine.exercises.forEach(ex => addBuilderExerciseRow(ex));
}
function addBuilderExerciseRow(ex = null) {
    const exId = ex ? ex.id : `cust_${Date.now()}_${Math.floor(Math.random()*1000)}`; const name = ex ? ex.name : ''; const sets = ex ? ex.sets : ''; const target = ex ? ex.target : ''; const muscle = ex ? ex.muscle : '';
    let opts = '<option value="">-- Músculo --</option>'; muscleOptions.forEach(opt => { opts += `<option value="${opt}" ${opt === muscle ? 'selected' : ''}>${opt}</option>`; });
    document.getElementById('builder-exercises').insertAdjacentHTML('beforeend', `<div class="builder-row" data-exid="${exId}"><div class="builder-inputs"><input type="text" class="b-name" placeholder="Nombre Ejercicio" value="${name}"><div class="builder-flex"><select class="b-muscle" style="flex:2;">${opts}</select><input type="number" inputmode="numeric" class="b-sets" placeholder="Series" style="flex:1;" value="${sets}"><input type="text" class="b-target" placeholder="Reps" style="flex:2;" value="${target}"></div></div><button class="btn-delete" style="padding: 0 12px; background: transparent; border: none; font-size:1.5rem;" onclick="this.parentElement.remove()">&times;</button></div>`);
}
function saveCustomRoutine() {
    const name = document.getElementById('new-routine-name').value.trim(); const rule = document.getElementById('new-routine-rule').value.trim();
    if(!name) { alert("Ponle un nombre"); return; }
    let exercises = [];
    document.querySelectorAll('.builder-row').forEach(row => {
        const exName = row.querySelector('.b-name').value.trim();
        if(exName) exercises.push({ id: row.getAttribute('data-exid'), name: exName, muscle: row.querySelector('.b-muscle').value || M_OTHER, sets: parseInt(row.querySelector('.b-sets').value) || 3, target: row.querySelector('.b-target').value.trim() || "-" });
    });
    if(exercises.length === 0) { alert("Añade 1 ejercicio"); return; }
    let routineId = document.getElementById('routine-edit-select').value; if (routineId === 'NEW') routineId = 'custom_' + Date.now();
    const customRoutines = JSON.parse(localStorage.getItem('custom_routines') || '{}'); customRoutines[routineId] = { title: name, rule: rule, exercises: exercises };
    localStorage.setItem('custom_routines', JSON.stringify(customRoutines)); localStorage.removeItem('draft_' + routineId);
    showToast("Rutina Guardada"); populateBuilderDropdown(); document.getElementById('routine-edit-select').value = routineId;
}
function deleteCurrentRoutine() {
    const routineId = document.getElementById('routine-edit-select').value; if(routineId === 'NEW') return;
    if(confirm("¿Seguro que quieres borrar esta rutina?")) {
        const hiddenRoutines = JSON.parse(localStorage.getItem('hidden_routines') || '[]');
        if (!hiddenRoutines.includes(routineId)) { hiddenRoutines.push(routineId); localStorage.setItem('hidden_routines', JSON.stringify(hiddenRoutines)); }
        showToast("Rutina eliminada"); populateBuilderDropdown(); loadRoutineForEdit(); 
    }
}

// === ESTADÍSTICAS ===
function switchStatView(viewId) {
    document.querySelectorAll('.stat-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.stats-nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(`stat-view-${viewId}`).classList.add('active'); document.getElementById(`sbtn-${viewId}`).classList.add('active');
    if(viewId === 'calendar') renderCalendar();
}
function getRecentHistory(days = 30) {
    const history = JSON.parse(localStorage.getItem('workout_history') || '[]'); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); return history.filter(w => new Date(w.date) >= cutoff);
}
function renderHabitsStats() {
    const history30 = getRecentHistory(30); const container = document.getElementById('habits-container');
    if (history30.length === 0) { container.innerHTML = "<p style='text-align:center; color:var(--text-muted);'>No hay datos recientes.</p>"; return; }
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]; const dayCounts = [0,0,0,0,0,0,0];
    history30.forEach(w => dayCounts[new Date(w.date).getDay()]++);
    const maxDays = Math.max(...dayCounts); const favDayIdx = dayCounts.indexOf(maxDays);
    let html = `<div class="habit-block"><h4 style="color:var(--text-muted)">Sesiones Totales</h4><div class="number">${history30.length}</div></div><div class="habit-block"><h4 style="color:var(--text-muted)">Día Favorito</h4><div class="number" style="font-size:1.8rem;">${dayNames[favDayIdx]}</div></div><div style="margin-top: 25px;"><h4 style="margin-bottom:15px; font-size:0.9rem; color:var(--text-muted); text-transform:uppercase;">Distribución Semanal</h4>`;
    [1, 2, 3, 4, 5, 6, 0].forEach(dayIdx => {
        const width = maxDays > 0 ? (dayCounts[dayIdx] / maxDays) * 100 : 0;
        html += `<div class="day-bar-container"><div class="day-bar-label">${dayNames[dayIdx].substring(0,3)}.</div><div class="day-bar-track"><div class="day-bar-fill" style="width: ${width}%;"></div></div><div class="day-bar-count">${dayCounts[dayIdx]}</div></div>`;
    });
    container.innerHTML = html + `</div>`;
}
function renderMuscleStats() {
    const history30 = getRecentHistory(30); const container = document.getElementById('muscles-container');
    const muscleTally = {};
    history30.filter(w => w.type !== 'cardio').forEach(w => {
        for (const exId in w.exercises) {
            const validSets = w.exercises[exId].filter(s => s.weight !== "" || s.reps !== "").length;
            if (validSets > 0 && w.exerciseMetadata && w.exerciseMetadata[exId]) {
                const m = w.exerciseMetadata[exId].muscle || M_OTHER; muscleTally[m] = (muscleTally[m] || 0) + validSets;
            }
        }
    });
    const sortedMuscles = Object.keys(muscleTally).sort((a,b) => muscleTally[b] - muscleTally[a]);
    if (sortedMuscles.length === 0) { container.innerHTML = "<p style='text-align:center; color:var(--text-muted);'>Sin datos recientes.</p>"; return; }
    let html = ""; const maxSets = muscleTally[sortedMuscles[0]];
    sortedMuscles.forEach(m => {
        html += `<div class="day-bar-container"><div class="day-bar-label" style="text-align:left;">${m}</div><div class="day-bar-track"><div class="day-bar-fill" style="width: ${(muscleTally[m] / maxSets) * 100}%;"></div></div><div class="day-bar-count">${muscleTally[m]}</div></div>`;
    });
    container.innerHTML = html;
}
function populateStatsDropdown() {
    const select = document.getElementById('stat-exercise-selector'); select.innerHTML = '<option value="">-- Selecciona un Ejercicio --</option>';
    const allExercises = {};
    Object.values(getMergedRoutines()).forEach(day => day.exercises.forEach(ex => allExercises[ex.id] = ex.name));
    JSON.parse(localStorage.getItem('workout_history') || '[]').forEach(w => { if(w.exerciseMetadata) Object.keys(w.exerciseMetadata).forEach(id => { if (!allExercises[id]) allExercises[id] = w.exerciseMetadata[id].name; }); });
    Object.keys(allExercises).sort((a, b) => allExercises[a].localeCompare(allExercises[b])).forEach(id => {
        const opt = document.createElement('option'); opt.value = id; opt.textContent = allExercises[id]; select.appendChild(opt);
    });
}
function loadExerciseStats() {
    const exId = document.getElementById('stat-exercise-selector').value; const list = document.getElementById('stats-list');
    if (!exId) { list.innerHTML = ''; return; }
    const exStats = [];
    JSON.parse(localStorage.getItem('workout_history') || '[]').forEach(w => {
        if (w.type !== 'cardio' && w.exercises[exId] && w.exercises[exId].some(set => set.weight !== "" || set.reps !== "")) {
            const dateObj = new Date(w.date); exStats.push({ date: dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), sets: w.exercises[exId] });
        }
    });
    if (exStats.length === 0) { list.innerHTML = '<p style="text-align: center; color:var(--text-muted); margin-top:20px;">No hay datos aún.</p>'; return; }
    list.innerHTML = "";
    exStats.reverse().forEach(stat => {
        let setsHtml = ''; stat.sets.forEach((set, idx) => { if (set.weight !== "" || set.reps !== "") setsHtml += `<div class="stat-set-badge">S${idx + 1}: ${set.weight||'-'}kg × ${set.reps||'-'}</div>`; });
        list.innerHTML += `<div class="stat-row"><div class="stat-header"><span>${stat.date}</span></div><div class="stat-sets">${setsHtml}</div></div>`;
    });
}

// === CALENDARIO ===
let calDate = new Date();
function initCalendar() { renderCalendar(); }
function changeMonth(dir) { calDate.setMonth(calDate.getMonth() + dir); renderCalendar(); }
function renderCalendar() {
    const bodyEl = document.getElementById('cal-body'); bodyEl.innerHTML = '';
    const year = calDate.getFullYear(); const month = calDate.getMonth();
    document.getElementById('cal-month-year').textContent = `${["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][month]} ${year}`;
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for(let i=0; i<offset; i++) bodyEl.innerHTML += `<div class="cal-cell empty"></div>`;
    const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
    for(let day=1; day<=new Date(year, month + 1, 0).getDate(); day++) {
        let hasStrength = false, hasCardio = false;
        history.forEach(w => { const d = new Date(w.date); if(d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) { w.type === 'cardio' ? hasCardio = true : hasStrength = true; } });
        let classes = 'cal-cell' + (new Date(year, month, day).toDateString() === new Date().toDateString() ? ' today' : '');
        let indicators = (hasStrength ? '<div class="dot strength"></div>' : '') + (hasCardio ? '<div class="dot cardio"></div>' : '');
        bodyEl.innerHTML += `<div class="${classes}" onclick="openDaySummary('${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}')">${day}<div class="cal-indicators">${indicators}</div></div>`;
    }
}
function openDaySummary(dateStr) {
    const [y, m, d] = dateStr.split('-'); const sessions = JSON.parse(localStorage.getItem('workout_history') || '[]').filter(w => { const wd = new Date(w.date); return wd.getFullYear() == y && wd.getMonth() == m-1 && wd.getDate() == d; });
    document.getElementById('modal-date-title').textContent = new Date(y, m-1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const container = document.getElementById('modal-summaries'); container.innerHTML = '';
    if (sessions.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; margin-top:30px;">Día de descanso.</p>'; document.getElementById('day-modal').classList.add('active'); return; }
    const routines = getMergedRoutines();
    sessions.forEach(s => {
        const timeStr = new Date(s.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if (s.type === 'cardio') {
            container.innerHTML += `<div class="summary-card cardio-theme"><h4>🏃 ${s.modality} <span style="float:right; font-size:0.8rem; color:var(--text-muted); font-weight:normal;">${timeStr}</span></h4><div class="summary-detail">⏱️ ${s.duration} min ${s.distance ? `| 📏 ${s.distance} km` : ''} ${s.cal ? `| 🔥 ${s.cal} kcal` : ''}</div>${s.fcMed || s.fcMax ? `<div class="summary-detail">❤️ FC: ${s.fcMed||'-'} med / ${s.fcMax||'-'} max</div>` : ''}${s.notes ? `<div class="summary-detail" style="margin-top:8px; font-style:italic; border-top:1px solid var(--border-color); padding-top:8px;">"${s.notes}"</div>` : ''}</div>`;
        } else {
            let html = `<div class="summary-card"><h4>💪 ${s.dayId && routines[s.dayId] ? routines[s.dayId].title : "Fuerza"} <span style="float:right; font-size:0.8rem; color:var(--text-muted); font-weight:normal;">${timeStr}</span></h4>`;
            for (const exId in s.exercises) {
                const sets = s.exercises[exId].filter(set => set.weight !== "" || set.reps !== "");
                if(sets.length > 0) {
                    html += `<div style="margin-top:12px; font-weight:600; font-size:0.9rem; color:var(--text-color);">${s.exerciseMetadata && s.exerciseMetadata[exId] ? s.exerciseMetadata[exId].name : "Ejercicio"}</div><div class="stat-sets" style="margin-top:5px;">`;
                    sets.forEach((set, idx) => html += `<span class="stat-set-badge">S${idx+1}: ${set.weight||'-'}kg × ${set.reps||'-'}</span>`);
                    html += `</div>`;
                }
            }
            container.innerHTML += html + `</div>`;
        }
    });
    document.getElementById('day-modal').classList.add('active');
}
function closeModal(event) { document.getElementById('day-modal').classList.remove('active'); }

// === BACKUP & EXPORT ===
function exportBackup() {
    const data = { workout_history: JSON.parse(localStorage.getItem('workout_history') || '[]'), custom_routines: JSON.parse(localStorage.getItem('custom_routines') || '{}'), hidden_routines: JSON.parse(localStorage.getItem('hidden_routines') || '[]') };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = `tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Backup exportado 💾");
}
function importBackup(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result); if (!data.workout_history) { alert("Archivo no válido."); return; }
            if (confirm("⚠️ Importar sobrescribirá tus datos actuales. ¿Seguro?")) {
                localStorage.setItem('workout_history', JSON.stringify(data.workout_history || [])); localStorage.setItem('custom_routines', JSON.stringify(data.custom_routines || {})); localStorage.setItem('hidden_routines', JSON.stringify(data.hidden_routines || []));
                showToast("Datos restaurados ✅"); setTimeout(() => location.reload(), 800);
            }
        } catch (err) { alert("Error al leer el archivo JSON."); }
    }; reader.readAsText(file);
}

// EXPORTACIÓN A EXCEL (.CSV)
function exportCSV() {
    const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
    let csvContent = "Fecha,Hora,Tipo,Rutina_Modalidad,Ejercicio,Musculo,Serie,Peso_Distancia,Reps_Tiempo,Notas\n";

    history.forEach(w => {
        const dObj = new Date(w.date);
        const dateStr = dObj.toLocaleDateString('es-ES');
        const timeStr = dObj.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
        
        if (w.type === 'cardio') {
            const cleanNotes = (w.notes || "").replace(/"/g, '""'); // Escapar comillas dobles en Excel
            csvContent += `"${dateStr}","${timeStr}","Cardio","${w.modality}","","","","${w.distance||''}","${w.duration||''}","${cleanNotes}"\n`;
        } else {
            const rTitle = w.dayId ? w.dayId : "Fuerza";
            for (const exId in w.exercises) {
                const exMeta = w.exerciseMetadata && w.exerciseMetadata[exId] ? w.exerciseMetadata[exId] : {name: "N/A", muscle: "Otro"};
                w.exercises[exId].forEach((set, idx) => {
                    if (set.weight !== "" || set.reps !== "") {
                        csvContent += `"${dateStr}","${timeStr}","Fuerza","${rTitle}","${exMeta.name}","${exMeta.muscle}","${idx+1}","${set.weight}","${set.reps}",""\n`;
                    }
                });
            }
        }
    });

    // Encoding UTF-8 con BOM para que Excel lea los acentos directamente
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `entrenamientos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("Exportado a Excel 📊");
}

function showToast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.className = "show"; setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000); }