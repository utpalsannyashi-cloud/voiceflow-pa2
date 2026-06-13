// State
let mode = 'clean', isRecording = false, recognition = null, history = [], settings = {};
const el = id => document.getElementById(id);

(async () => {
  settings = await window.electronAPI.getSettings();
  el('apiKeyInput').value = settings.apiKey || '';
  el('hotkeyInput').value = settings.hotkey || 'CommandOrControl+Shift+Space';
  el('hotkeyHint').textContent = settings.hotkey || 'Ctrl+Shift+Space';
  el('defaultModeInput').value = settings.mode || 'clean';
  setMode(settings.mode || 'clean');
  window.electronAPI.onRecordingState(val => {
    isRecording = val; updateMicUI();
    if (isRecording) startRecognition(); else stopRecognition();
  });
})();

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
}
document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

el('micBtn').addEventListener('click', () => {
  if (!isRecording) { isRecording = true; updateMicUI(); startRecognition(); }
  else { isRecording = false; updateMicUI(); stopRecognition(); }
});

function updateMicUI() {
  el('micBtn').classList.toggle('recording', isRecording);
  el('micLabel').textContent = isRecording ? 'Recording... click to stop' : 'Click or use hotkey to record';
}

function startRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    setStatus('Speech recognition not supported', false); return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';
  let finalTranscript = '';
  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    setStatus('Listening: ' + finalTranscript + interim, true);
  };
  recognition.onerror = e => setStatus('Error: ' + e.error, false);
  recognition.onend = () => {
    if (finalTranscript.trim()) processWithDeepSeek(finalTranscript.trim());
    else setStatus('No speech detected. Try again.', false);
  };
  recognition.start();
  setStatus('Listening...', true);
}

function stopRecognition() { if (recognition) { recognition.stop(); recognition = null; } }

async function processWithDeepSeek(transcript) {
  if (!settings.apiKey) {
    el('outputBox').textContent = transcript;
    setStatus('No API key — raw transcript shown. Add key in Settings.', false); return;
  }
  const lang = el('langSelect').value;
  const prompts = {
    clean:     'Remove filler words, fix punctuation and grammar. Return only the cleaned text:\n\n' + transcript,
    polish:    'Rewrite in clear, neutral, plain language. Return only the rewritten text:\n\n' + transcript,
    translate: 'Translate to ' + lang + '. Return only the translation:\n\n' + transcript,
    all:       'Do in sequence: 1) Remove fillers and fix grammar. 2) Polish to clear neutral language. 3) Translate to ' + lang + '. Return only the final result:\n\n' + transcript
  };
  setStatus('Processing with DeepSeek...', true);
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 1024, messages: [{ role: 'user', content: prompts[mode] }] })
    });
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const output = data.choices?.[0]?.message?.content?.trim() || transcript;
    el('outputBox').textContent = output;
    addToHistory(transcript, output, mode);
    setStatus('Done — inject or copy below', false);
  } catch (err) {
    el('outputBox').textContent = transcript;
    setStatus(err.message + ' — raw transcript shown', false);
  }
}

el('injectBtn').addEventListener('click', async () => {
  const text = el('outputBox').textContent.trim();
  if (!text) return;
  setStatus('Injecting...', true);
  await window.electronAPI.injectText(text);
  setStatus('Injected into active app!', false);
});

el('copyBtn').addEventListener('click', () => {
  const text = el('outputBox').textContent.trim();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => setStatus('Copied to clipboard!', false));
});

el('clearBtn').addEventListener('click', () => { el('outputBox').textContent = ''; setStatus('Ready', false); });

function addToHistory(original, processed, m) {
  history.unshift({ original, processed, mode: m, time: new Date().toLocaleTimeString() });
  if (history.length > 20) history.pop();
  el('historyToggle').textContent = 'History (' + history.length + ')';
}

el('historyToggle').addEventListener('click', () => {
  if (!history.length) return;
  el('outputBox').textContent = history.map((h, i) => '[' + (i+1) + '] ' + h.time + ' - ' + h.mode.toUpperCase() + '\n-> ' + h.processed).join('\n\n');
  setStatus('Showing ' + history.length + ' history entries', false);
});

el('gearBtn').addEventListener('click', () => el('settingsPanel').classList.add('open'));
el('cancelSettingsBtn').addEventListener('click', () => el('settingsPanel').classList.remove('open'));
el('saveSettingsBtn').addEventListener('click', async () => {
  const data = { apiKey: el('apiKeyInput').value.trim(), hotkey: el('hotkeyInput').value.trim(), mode: el('defaultModeInput').value };
  settings = await window.electronAPI.saveSettings(data);
  el('hotkeyHint').textContent = data.hotkey;
  setMode(data.mode);
  el('settingsPanel').classList.remove('open');
  setStatus('Settings saved', false);
});

el('closeBtn').addEventListener('click', () => window.electronAPI.hideWindow());

function setStatus(msg, active) {
  el('status').textContent = msg;
  el('status').classList.toggle('active', active);
}