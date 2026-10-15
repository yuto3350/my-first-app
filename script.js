// 保存するデータは、このブラウザだけで使用します。
const STORAGE_KEY = 'training-records-v1';
const form = document.querySelector('#record-form');
const exercisesByPart = {
  '胸': ['ベンチプレス', 'ダンベルプレス', 'ダンベルフライ', '腕立て伏せ'],
  '背中': ['デッドリフト', 'ラットプルダウン', '懸垂', 'シーテッドロー'],
  '脚': ['スクワット', 'レッグプレス', 'レッグエクステンション', 'レッグカール', 'カーフレイズ'],
  'その他': ['ショルダープレス', 'ダンベルカール', 'サイドレイズ', 'トライセプスエクステンション', '腹筋', 'その他'],
};
const bodyPart = document.querySelector('#body-part');
const historyPart = document.querySelector('#history-part');
const exercise = document.querySelector('#exercise');
const weight = document.querySelector('#weight');
const reps = document.querySelector('#reps');
const sets = document.querySelector('#sets');
const date = document.querySelector('#date');
const message = document.querySelector('#message');
const cancelButton = document.querySelector('#cancel-button');
let records = [];
let editingId = null;
let storageReadable = true;

function partForExercise(name) {
  return Object.keys(exercisesByPart).find(part => exercisesByPart[part].includes(name));
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

function validRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const validDate = typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date) && record.date.slice(0, 4) !== '0000' && new Date(`${record.date}T00:00:00Z`).toISOString().slice(0, 10) === record.date;
  return typeof record.id === 'string' && record.id.length > 0 &&
    Boolean(partForExercise(record.exercise)) &&
    Number.isFinite(record.weight) && record.weight >= 0 && record.weight <= 10000 &&
    Number.isInteger(record.reps) && record.reps >= 1 && record.reps <= 10000 &&
    Number.isInteger(record.sets) && record.sets >= 1 && record.sets <= 1000 && validDate;
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
  exercise.value = record.exercise;
  weight.value = record.weight;
  reps.value = record.reps;
  sets.value = record.sets;
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
    const stats = document.createElement('dl');
    stats.className = 'stats';
    for (const [label, value] of [['重量', `${record.weight} kg`], ['回数', `${record.reps} 回`], ['セット数', `${record.sets} セット`]]) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      group.append(term, detail);
      stats.append(group);
    }
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
    weight: Number(weight.value),
    reps: Number(reps.value),
    sets: Number(sets.value),
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
