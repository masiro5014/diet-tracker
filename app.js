/* ===== 状態管理 ===== */
let currentDate = toDateKey(new Date());
let settings = loadSettings();

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function loadSettings() {
  return JSON.parse(localStorage.getItem('diet_settings') || '{"goal":2000,"weight":65}');
}

function saveSettings() {
  localStorage.setItem('diet_settings', JSON.stringify(settings));
}

function loadDayData(dateKey) {
  return JSON.parse(localStorage.getItem('diet_' + dateKey) || '{"foods":[],"exercises":[]}');
}

function saveDayData(dateKey, data) {
  localStorage.setItem('diet_' + dateKey, JSON.stringify(data));
}

/* ===== 初期化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  renderDateLabel();
  renderAll();
  setupTabs();
  setupDateNav();
  setupFoodForm();
  setupExerciseForm();
  setupSettings();
  setupAutocomplete('foodSearch', FOOD_DB.map(f => f.name), onFoodSuggestSelect);
  setupAutocomplete('exerciseSearch', EXERCISE_DB.map(e => e.name), onExerciseSuggestSelect);
});

/* ===== 日付ナビ ===== */
function renderDateLabel() {
  const d = new Date(currentDate + 'T00:00:00');
  const today = toDateKey(new Date());
  const label = currentDate === today ? '今日 ' : '';
  const formatted = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  document.getElementById('currentDateLabel').textContent = label + formatted;
}

function setupDateNav() {
  document.getElementById('prevDay').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDay').addEventListener('click', () => shiftDate(+1));
}

function shiftDate(delta) {
  const d = new Date(currentDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  currentDate = toDateKey(d);
  renderDateLabel();
  renderAll();
}

/* ===== タブ ===== */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ===== サマリー描画 ===== */
function renderAll() {
  const data = loadDayData(currentDate);
  const totalIntake = data.foods.reduce((s, f) => s + f.calories, 0);
  const totalBurn   = data.exercises.reduce((s, e) => s + e.calories, 0);
  const net = totalIntake - totalBurn;
  const remaining = settings.goal - net;

  document.getElementById('totalIntake').textContent   = Math.round(totalIntake);
  document.getElementById('totalBurn').textContent     = Math.round(totalBurn);
  document.getElementById('netCalories').textContent   = Math.round(net);
  document.getElementById('remainingCalories').textContent = Math.round(remaining);

  // 進捗バー
  const pct = Math.min((net / settings.goal) * 100, 100);
  const bar = document.getElementById('progressBar');
  bar.style.width = pct + '%';
  bar.classList.toggle('over', net > settings.goal);
  document.getElementById('progressLabel').textContent = `${Math.round(net)} / ${settings.goal} kcal`;

  // マクロ
  const totalCarb    = data.foods.reduce((s, f) => s + (f.carb    || 0), 0);
  const totalProtein = data.foods.reduce((s, f) => s + (f.protein || 0), 0);
  const totalFat     = data.foods.reduce((s, f) => s + (f.fat     || 0), 0);
  const macroGoal = settings.goal;
  document.getElementById('carbVal').textContent    = Math.round(totalCarb)    + 'g';
  document.getElementById('proteinVal').textContent = Math.round(totalProtein) + 'g';
  document.getElementById('fatVal').textContent     = Math.round(totalFat)     + 'g';
  // 目標カロリーに対するマクロ比率 (炭水化物60%, タンパク質15%, 脂質25%の推奨比)
  setBarWidth('carbBar',    (totalCarb    * 4 / macroGoal) * 100 / 0.60);
  setBarWidth('proteinBar', (totalProtein * 4 / macroGoal) * 100 / 0.15);
  setBarWidth('fatBar',     (totalFat     * 9 / macroGoal) * 100 / 0.25);

  renderFoodLog(data.foods);
  renderExerciseLog(data.exercises);
}

function setBarWidth(id, pct) {
  document.getElementById(id).style.width = Math.min(pct, 100) + '%';
}

/* ===== 食事ログ描画 ===== */
function renderFoodLog(foods) {
  const container = document.getElementById('foodLog');
  if (foods.length === 0) {
    container.innerHTML = '<div class="empty-state">まだ食事が記録されていません</div>';
    return;
  }

  const mealOrder = ['朝食', '昼食', '夕食', '間食'];
  const grouped = {};
  mealOrder.forEach(m => { grouped[m] = []; });
  foods.forEach(f => {
    if (!grouped[f.mealType]) grouped[f.mealType] = [];
    grouped[f.mealType].push(f);
  });

  const icons = { '朝食': '🌅', '昼食': '☀️', '夕食': '🌙', '間食': '🍬' };
  let html = '';
  mealOrder.forEach(meal => {
    if (!grouped[meal] || grouped[meal].length === 0) return;
    const subtotal = grouped[meal].reduce((s, f) => s + f.calories, 0);
    html += `<div class="meal-group">
      <div class="meal-group-title">${icons[meal] || '🍽️'} ${meal} — ${Math.round(subtotal)} kcal</div>`;
    grouped[meal].forEach(f => {
      const macroStr = [
        f.carb    != null ? `炭${Math.round(f.carb)}g`    : '',
        f.protein != null ? `P${Math.round(f.protein)}g`  : '',
        f.fat     != null ? `脂${Math.round(f.fat)}g`     : '',
      ].filter(Boolean).join('　');
      html += `<div class="log-item">
        <div class="log-item-icon">🍽️</div>
        <div class="log-item-info">
          <div class="log-item-name">${escHtml(f.name)}</div>
          <div class="log-item-meta">${f.amount}${f.unit || 'g'}　${macroStr}</div>
        </div>
        <div class="log-item-cal">${Math.round(f.calories)} kcal</div>
        <button class="log-item-delete" onclick="deleteFood('${f.id}')">✕</button>
      </div>`;
    });
    html += '</div>';
  });
  container.innerHTML = html;
}

/* ===== 運動ログ描画 ===== */
function renderExerciseLog(exercises) {
  const container = document.getElementById('exerciseLog');
  if (exercises.length === 0) {
    container.innerHTML = '<div class="empty-state">まだ運動が記録されていません</div>';
    return;
  }
  let html = '';
  exercises.forEach(e => {
    html += `<div class="log-item">
      <div class="log-item-icon">${e.icon || '🏃'}</div>
      <div class="log-item-info">
        <div class="log-item-name">${escHtml(e.name)}</div>
        <div class="log-item-meta">${e.duration}分</div>
      </div>
      <div class="log-item-cal">-${Math.round(e.calories)} kcal</div>
      <button class="log-item-delete" onclick="deleteExercise('${e.id}')">✕</button>
    </div>`;
  });
  container.innerHTML = html;
}

/* ===== 食事追加 ===== */
function setupFoodForm() {
  document.getElementById('addFoodBtn').addEventListener('click', () => {
    const name     = document.getElementById('foodSearch').value.trim();
    const amount   = parseFloat(document.getElementById('foodAmount').value) || 100;
    const calories = parseFloat(document.getElementById('foodCalories').value);
    const carb     = parseFloat(document.getElementById('foodCarb').value)     || 0;
    const protein  = parseFloat(document.getElementById('foodProtein').value)  || 0;
    const fat      = parseFloat(document.getElementById('foodFat').value)      || 0;
    const mealType = document.getElementById('mealType').value;

    if (!name) { alert('食品名を入力してください'); return; }
    if (isNaN(calories) || calories < 0) { alert('カロリーを入力してください'); return; }

    const dbItem = FOOD_DB.find(f => f.name === name);
    const unit = dbItem ? dbItem.unit : 'g';

    const data = loadDayData(currentDate);
    data.foods.push({
      id: genId(), name, amount, unit, calories, carb, protein, fat, mealType
    });
    saveDayData(currentDate, data);
    clearFoodForm();
    renderAll();
  });

  // Enterキー対応
  document.getElementById('foodSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addFoodBtn').click();
  });
}

function clearFoodForm() {
  document.getElementById('foodSearch').value   = '';
  document.getElementById('foodAmount').value   = '100';
  document.getElementById('foodCalories').value = '';
  document.getElementById('foodCarb').value     = '';
  document.getElementById('foodProtein').value  = '';
  document.getElementById('foodFat').value      = '';
  document.getElementById('foodSuggestions').classList.add('hidden');
}

function deleteFood(id) {
  const data = loadDayData(currentDate);
  data.foods = data.foods.filter(f => f.id !== id);
  saveDayData(currentDate, data);
  renderAll();
}

/* ===== 運動追加 ===== */
function setupExerciseForm() {
  document.getElementById('addExerciseBtn').addEventListener('click', () => {
    const name     = document.getElementById('exerciseSearch').value.trim();
    const duration = parseFloat(document.getElementById('exerciseDuration').value) || 30;
    let calories   = parseFloat(document.getElementById('exerciseCalories').value);
    const weight   = parseFloat(document.getElementById('bodyWeight').value) || settings.weight || 65;

    if (!name) { alert('運動名を入力してください'); return; }

    const dbItem = EXERCISE_DB.find(e => e.name === name);
    if (isNaN(calories) || calories <= 0) {
      if (dbItem) {
        calories = dbItem.met * weight * (duration / 60);
      } else {
        alert('消費カロリーを入力してください'); return;
      }
    }

    const icon = dbItem ? dbItem.icon : '🏃';
    const data = loadDayData(currentDate);
    data.exercises.push({ id: genId(), name, duration, calories, icon });
    saveDayData(currentDate, data);
    clearExerciseForm();
    renderAll();
  });

  document.getElementById('exerciseSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addExerciseBtn').click();
  });

  // 体重フィールドに設定値を初期表示
  document.getElementById('bodyWeight').value = settings.weight || '';
}

function clearExerciseForm() {
  document.getElementById('exerciseSearch').value   = '';
  document.getElementById('exerciseDuration').value = '30';
  document.getElementById('exerciseCalories').value = '';
  document.getElementById('exerciseSuggestions').classList.add('hidden');
}

function deleteExercise(id) {
  const data = loadDayData(currentDate);
  data.exercises = data.exercises.filter(e => e.id !== id);
  saveDayData(currentDate, data);
  renderAll();
}

/* ===== オートコンプリート ===== */
function setupAutocomplete(inputId, names, onSelect) {
  const input = document.getElementById(inputId);
  const list  = input.closest('.autocomplete-wrap').querySelector('.suggestions');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { list.classList.add('hidden'); return; }
    const matches = names.filter(n => n.includes(q)).slice(0, 8);
    if (matches.length === 0) { list.classList.add('hidden'); return; }
    list.innerHTML = matches.map(n => {
      const db = FOOD_DB.find(f => f.name === n) || EXERCISE_DB.find(e => e.name === n);
      const meta = db
        ? ('cal' in db ? `${db.cal}kcal/100${db.unit}` : `MET ${db.met}`)
        : '';
      return `<li data-name="${escAttr(n)}">${escHtml(n)}<span class="sug-cal">${meta}</span></li>`;
    }).join('');
    list.classList.remove('hidden');
    list.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        input.value = li.dataset.name;
        list.classList.add('hidden');
        onSelect(li.dataset.name);
      });
    });
  });

  document.addEventListener('click', e => {
    if (!input.closest('.autocomplete-wrap').contains(e.target)) {
      list.classList.add('hidden');
    }
  });
}

function onFoodSuggestSelect(name) {
  const item = FOOD_DB.find(f => f.name === name);
  if (!item) return;
  const amount = parseFloat(document.getElementById('foodAmount').value) || 100;
  const ratio  = amount / 100;
  document.getElementById('foodCalories').value = Math.round(item.cal * ratio);
  document.getElementById('foodCarb').value     = +(item.carb    * ratio).toFixed(1);
  document.getElementById('foodProtein').value  = +(item.protein * ratio).toFixed(1);
  document.getElementById('foodFat').value      = +(item.fat     * ratio).toFixed(1);
}

function onExerciseSuggestSelect(name) {
  const item = EXERCISE_DB.find(e => e.name === name);
  if (!item) return;
  const duration = parseFloat(document.getElementById('exerciseDuration').value) || 30;
  const weight   = parseFloat(document.getElementById('bodyWeight').value) || settings.weight || 65;
  const cal = item.met * weight * (duration / 60);
  document.getElementById('exerciseCalories').value = Math.round(cal);
}

// 量を変えたときにカロリーを再計算
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('foodAmount').addEventListener('input', () => {
    const name = document.getElementById('foodSearch').value.trim();
    if (name) onFoodSuggestSelect(name);
  });
  document.getElementById('exerciseDuration').addEventListener('input', () => {
    const name = document.getElementById('exerciseSearch').value.trim();
    if (name) onExerciseSuggestSelect(name);
  });
  document.getElementById('bodyWeight').addEventListener('input', () => {
    const name = document.getElementById('exerciseSearch').value.trim();
    if (name) onExerciseSuggestSelect(name);
  });
});

/* ===== 設定モーダル ===== */
function setupSettings() {
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('goalInput').value   = settings.goal;
    document.getElementById('weightInput').value = settings.weight;
    document.getElementById('settingsModal').classList.remove('hidden');
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('saveSettings').addEventListener('click', () => {
    const g = parseInt(document.getElementById('goalInput').value);
    const w = parseFloat(document.getElementById('weightInput').value);
    if (g < 500 || g > 5000) { alert('目標カロリーは500〜5000の範囲で入力してください'); return; }
    settings.goal   = g;
    settings.weight = w || 65;
    saveSettings();
    document.getElementById('bodyWeight').value = settings.weight;
    document.getElementById('settingsModal').classList.add('hidden');
    renderAll();
  });
  document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
}

/* ===== ユーティリティ ===== */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return escHtml(str);
}

/* ===== サービスワーカー登録 ===== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
