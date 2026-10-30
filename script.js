// 保存するデータは、このブラウザだけで使用します。
const STORAGE_KEY = 'training-records-v1';
const form = document.querySelector('#record-form');
const exercisesByPart = {
  '胸': ['ベンチプレス', 'ダンベルプレス', 'ダンベルフライ', 'インクラインスミスベンチ', 'ペックフライ'],
  '背中': ['ラットプルダウン', 'シーテッドロー', 'プルオーバー', 'デッドリフト', '懸垂'],
  '脚': ['スクワット', 'レッグプレス', 'レッグエクステンション', 'レッグカール', '内もも', '外もも'],
  '腕': ['ケーブルカール', 'ケーブルプレスダウン', 'ダンベルカール', 'ケーブルリバース'],
  'その他': ['ショルダープレス', 'サイドレイズ', 'トライセプスエクステンション', '腹筋', 'その他'],
};
// 選択肢から外した種目も、過去の記録の読み込みと編集では扱います。
const retiredExercisesByPart = { '胸': ['腕立て伏せ'], '脚': ['カーフレイズ'] };
const bodyPart = document.querySelector('#body-part');
const historyPart = document.querySelector('#history-part');
const exercise = document.querySelector('#exercise');
const setRows = document.querySelector('#set-rows');
const addSetButton = document.querySelector('#add-set');
const date = document.querySelector('#date');
const message = document.querySelector('#message');
const cancelButton = document.querySelector('#cancel-button');
let records = [];
let editingId = null;
let storageReadable = true;

function partForExercise(name) {
  return Object.keys(exercisesByPart).find(part => exercisesByPart[part].includes(name) || (retiredExercisesByPart[part] || []).includes(name));
}

function updateExerciseOptions() {
  exercise.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = bodyPart.value ? '種目を選択してください' : '先に部位を選択してください';
  exercise.append(placeholder);
  for (const name of exercisesByPart[bodyPart.value] || []) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    exercise.append(option);
  }
  exercise.disabled = !bodyPart.value;
}
bodyPart.addEventListener('change', updateExerciseOptions);
historyPart.addEventListener('change', renderRecords);

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}


function validSet(set) {
  return set && typeof set === 'object' &&
    Number.isFinite(set.weight) && set.weight >= 0 && set.weight <= 10000 &&
    Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 10000;
}

function setsForRecord(record) {
  return Array.isArray(record.sets) ? record.sets :
    Array.from({ length: record.sets }, () => ({ weight: record.weight, reps: record.reps }));
}

function renumberSets() {
  Array.from(setRows.children).forEach((row, index) => {
    row.querySelector('.set-number').textContent = `${index + 1}セット目`;
    row.querySelector('button').disabled = setRows.children.length === 1;
  });
  addSetButton.disabled = setRows.children.length >= 1000;
}

function addSet(values = { weight: '', reps: '' }) {
  if (setRows.children.length >= 1000) return;
  const row = document.createElement('div');
  row.className = 'set-row';
  const number = document.createElement('span');
  number.className = 'set-number';
  row.append(number);
  for (const [key, text, min, max, step] of [['weight', '重量（kg）', 0, 10000, 0.1], ['reps', '回数', 1, 10000, 1]]) {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'set-' + key;
    input.min = min;
    input.max = max;
    input.step = step;
    input.required = true;
    input.value = values[key];
    label.append(input);
    row.append(label);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.textContent = '外す';
  remove.addEventListener('click', () => {
    if (setRows.children.length <= 1) return;
    row.remove();
    renumberSets();
  });
  row.append(remove);
  setRows.append(row);
  renumberSets();
}
addSetButton.addEventListener('click', () => {
  const last = setRows.lastElementChild;
  addSet(last ? {
    weight: last.querySelector('.set-weight').value,
    reps: last.querySelector('.set-reps').value,
  } : undefined);
});

function validRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const validDate = typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date) && record.date.slice(0, 4) !== '0000' && new Date(`${record.date}T00:00:00Z`).toISOString().slice(0, 10) === record.date;
  return typeof record.id === 'string' && record.id.length > 0 &&
    Boolean(partForExercise(record.exercise)) &&
    (Array.isArray(record.sets) ?
      record.sets.length >= 1 && record.sets.length <= 1000 && record.sets.every(validSet) :
      validSet(record) && Number.isInteger(record.sets) && record.sets >= 1 && record.sets <= 1000) && validDate;
}

// 書き込みに失敗したときは、表示中の記録を変更しません。
function saveRecords(nextRecords) {
  if (!storageReadable) {
    showMessage('保存データを読み込めないため変更できません。ブラウザの保存設定やデータを確認し、再読み込みしてください。', true);
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    records = nextRecords;
    renderRecords();
    return true;
  } catch {
    showMessage('保存できませんでした。ブラウザの保存設定や空き容量を確認してください。入力内容は残っています。', true);
    return false;
  }
}

function resetForm() {
  form.reset();
  setRows.replaceChildren();
  addSet();
  updateExerciseOptions();
  date.value = today();
  editingId = null;
  document.querySelector('#form-title').textContent = 'トレーニングを記録';
  document.querySelector('#save-button').textContent = '記録を保存';
  cancelButton.hidden = true;
}

function editRecord(record) {
  editingId = record.id;
  bodyPart.value = partForExercise(record.exercise);
  updateExerciseOptions();
  if (!exercisesByPart[bodyPart.value].includes(record.exercise)) {
    const option = document.createElement('option');
    option.value = record.exercise;
    option.textContent = record.exercise;
    exercise.append(option);
  }
  exercise.value = record.exercise;
  setRows.replaceChildren();
  setsForRecord(record).forEach(addSet);
  date.value = record.date;
  document.querySelector('#form-title').textContent = '記録を編集';
  document.querySelector('#save-button').textContent = '変更を保存';
  cancelButton.hidden = false;
  showMessage('内容を変更して「変更を保存」を押してください。');
  exercise.focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteRecord(record) {
  if (!window.confirm(`${record.date} の「${record.exercise}」を削除しますか？この操作は元に戻せません。`)) return;
  if (saveRecords(records.filter(item => item.id !== record.id))) {
    if (editingId === record.id) resetForm();
    showMessage('記録を削除しました。');
  }
}

function renderRecords() {
  const list = document.querySelector('#records');
  const openDates = new Set(Array.from(list.querySelectorAll('details[open]'), item => item.dataset.date));
  list.replaceChildren();
  const filtered = records.filter(record => !historyPart.value || partForExercise(record.exercise) === historyPart.value);
  document.querySelector('#count').textContent = `${filtered.length} 件`;
  const empty = document.querySelector('#empty');
  empty.hidden = filtered.length > 0;
  empty.textContent = historyPart.value ? `${historyPart.value}の記録はまだありません。` : 'まだ記録がありません。最初のトレーニングを記録してみましょう。';
  // 日付の新しい順。同日の記録は、新しく追加されたものを先に表示します。
  const sorted = [...filtered].reverse().sort((a, b) => b.date.localeCompare(a.date));
  const groups = new Map();
  for (const record of sorted) {
    if (!groups.has(record.date)) {
      const details = document.createElement('details');
      details.className = 'date-group';
      details.dataset.date = record.date;
      details.open = openDates.has(record.date);
      const summary = document.createElement('summary');
      const dateLabel = document.createElement('time');
      dateLabel.dateTime = record.date;
      dateLabel.textContent = record.date.replaceAll('-', ' / ');
      summary.append(dateLabel);
      const entries = document.createElement('div');
      entries.className = 'date-records';
      details.append(summary, entries);
      list.append(details);
      groups.set(record.date, entries);
    }
    const card = document.createElement('article');
    card.className = 'record';
    const time = document.createElement('time');
    time.dateTime = record.date;
    time.textContent = record.date.replaceAll('-', ' / ');
    const title = document.createElement('h3');
    title.textContent = record.exercise;
    const stats = document.createElement('table');
    stats.className = 'set-table';
    const caption = document.createElement('caption');
    caption.textContent = record.exercise + 'のセット別記録';
    stats.append(caption);
    const head = document.createElement('thead');
    const heading = document.createElement('tr');
    for (const label of ['セット', '重量', '回数']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      heading.append(th);
    }
    head.append(heading);
    stats.append(head);
    const tbody = document.createElement('tbody');
    setsForRecord(record).forEach((set, index) => {
      const tr = document.createElement('tr');
      for (const value of [`${index + 1}セット目`, `${set.weight} kg`, `${set.reps} 回`]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      tbody.append(tr);
    });
    stats.append(tbody);
    const actions = document.createElement('div');
    actions.className = 'record-actions';
    for (const [label, className, action] of [['編集', 'secondary', editRecord], ['削除', 'delete', deleteRecord]]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.setAttribute('aria-label', `${record.date} ${record.exercise}の${label}`);
      button.addEventListener('click', () => action(record));
      actions.append(button);
    }
    card.append(time, title, stats, actions);
    groups.get(record.date).append(card);
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const record = {
    id: editingId || crypto.randomUUID(),
    exercise: exercise.value,
    sets: Array.from(setRows.children, row => ({
      weight: Number(row.querySelector('.set-weight').value),
      reps: Number(row.querySelector('.set-reps').value),
    })),
    date: date.value,
  };
  if (!validRecord(record)) {
    showMessage('入力内容を確認してください。', true);
    return;
  }
  const wasEditing = editingId !== null;
  const nextRecords = wasEditing ? records.map(item => item.id === editingId ? record : item) : [...records, record];
  if (saveRecords(nextRecords)) {
    resetForm();
    showMessage(wasEditing ? '記録を更新しました。' : '記録を保存しました。');
  }
});
cancelButton.addEventListener('click', () => {
  resetForm();
  showMessage('編集をキャンセルしました。');
});

resetForm();
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed = saved === null ? [] : JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every(validRecord) || new Set(parsed.map(item => item.id)).size !== parsed.length) throw new Error('Invalid records');
  records = parsed;
} catch {
  storageReadable = false;
  showMessage('保存データを読み込めませんでした。既存データを保護するため、保存・削除を停止しています。ブラウザの保存設定やデータを確認してください。', true);
}
renderRecords();
