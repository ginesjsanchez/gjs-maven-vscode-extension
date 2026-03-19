"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MavenOptionsView = void 0;
class MavenOptionsView {
    constructor(context, optionsManager) {
        this.context = context;
        this.optionsManager = optionsManager;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this.webviewView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case 'ready':
                    this.sendState();
                    break;
                case 'add':
                    if (msg.name?.trim()) {
                        await this.optionsManager.addOption(msg.name.trim());
                        this.sendState();
                    }
                    break;
                case 'remove':
                    if (msg.name?.trim()) {
                        await this.optionsManager.removeOption(msg.name.trim());
                        this.sendState();
                    }
                    break;
                case 'clear':
                    await this.optionsManager.clearOptions();
                    this.sendState();
                    break;
                case 'setDebug':
                    await this.optionsManager.setDebug(msg.enabled);
                    this.sendState();
                    break;
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.sendState();
            }
        });
    }
    refresh() {
        if (this.webviewView?.visible) {
            this.sendState();
        }
    }
    sendState() {
        this.webviewView?.webview.postMessage({
            command: 'update',
            options: this.optionsManager.getOptions(),
            debug: this.optionsManager.isDebug()
        });
    }
    getHtml() {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
* { box-sizing: border-box; margin: 0; padding: 0; }
body { padding: 8px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); }
.section-header { margin-bottom: 6px; margin-top: 10px; }
.section-header:first-child { margin-top: 0; }
h3 { font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
.option-list { display: flex; flex-direction: column; gap: 2px; min-height: 20px; }
.option-item { display: flex; align-items: center; justify-content: space-between; background: var(--vscode-list-inactiveSelectionBackground); padding: 3px 6px; border-radius: 2px; }
.option-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; }
.btn-x { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 13px; padding: 0 2px; flex-shrink: 0; }
.btn-x:hover { color: var(--vscode-errorForeground); }
.empty { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 11px; padding: 2px 0; }
hr { border: none; border-top: 1px solid var(--vscode-widget-border, #444); margin: 10px 0; }
input[type="text"] { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, #555); padding: 3px 6px; font-size: var(--vscode-font-size); outline: none; border-radius: 2px; margin-bottom: 4px; font-family: monospace; }
input[type="text"]:focus { border-color: var(--vscode-focusBorder); }
button.primary { width: 100%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 6px; cursor: pointer; font-size: var(--vscode-font-size); border-radius: 2px; }
button.primary:hover { background: var(--vscode-button-hoverBackground); }
button.secondary { width: 100%; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 4px 6px; cursor: pointer; font-size: var(--vscode-font-size); border-radius: 2px; margin-top: 4px; }
button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.debug-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 6px; background: var(--vscode-list-inactiveSelectionBackground); border-radius: 2px; cursor: pointer; }
.debug-row input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; accent-color: var(--vscode-focusBorder); flex-shrink: 0; margin: 0; }
.debug-label { font-size: var(--vscode-font-size); cursor: pointer; user-select: none; }
.debug-hint { font-size: 11px; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>

<div class="section-header"><h3>Additional Options</h3></div>
<div class="option-list" id="list">
    <span class="empty">No additional options</span>
</div>
<button class="secondary" id="btn-clear-all">Remove all</button>

<hr>

<div class="section-header"><h3>Option</h3></div>
<input id="inp" type="text" placeholder="e.g. skipTests  or  env=dev" />
<button class="primary" id="btn-add">Add</button>

<hr>

<div class="debug-row" id="debug-row">
    <input type="checkbox" id="chk-debug" />
    <div>
        <div class="debug-label">Debug mode</div>
        <div class="debug-hint">Adds -X to Maven command</div>
    </div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

vscode.postMessage({ command: 'ready' });

window.addEventListener('message', e => {
    if (e.data.command === 'update') { render(e.data.options, e.data.debug); }
});

function render(options, debug) {
    const list = document.getElementById('list');
    if (!options || options.length === 0) {
        list.innerHTML = '<span class="empty">No additional options</span>';
    } else {
        list.innerHTML = options.map(o =>
            '<div class="option-item">' +
                '<span class="option-name">-D' + esc(o) + '</span>' +
                '<button class="btn-x" data-name="' + esc(o) + '" title="Remove">✕</button>' +
            '</div>'
        ).join('');
        list.querySelectorAll('.btn-x').forEach(function(btn) {
            btn.addEventListener('click', function() {
                vscode.postMessage({ command: 'remove', name: btn.getAttribute('data-name') });
            });
        });
    }
    document.getElementById('chk-debug').checked = !!debug;
}

document.getElementById('btn-add').addEventListener('click', function() {
    const inp = document.getElementById('inp');
    const name = inp.value.trim();
    if (!name) { return; }
    vscode.postMessage({ command: 'add', name });
    inp.value = '';
    inp.focus();
});

document.getElementById('btn-clear-all').addEventListener('click', function() {
    vscode.postMessage({ command: 'clear' });
});

document.getElementById('inp').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const inp = document.getElementById('inp');
        const name = inp.value.trim();
        if (!name) { return; }
        vscode.postMessage({ command: 'add', name });
        inp.value = '';
    }
});

document.getElementById('chk-debug').addEventListener('change', function() {
    vscode.postMessage({ command: 'setDebug', enabled: this.checked });
});

document.getElementById('debug-row').addEventListener('click', function(e) {
    if (e.target.id !== 'chk-debug') {
        const chk = document.getElementById('chk-debug');
        chk.checked = !chk.checked;
        vscode.postMessage({ command: 'setDebug', enabled: chk.checked });
    }
});

function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
    }
}
exports.MavenOptionsView = MavenOptionsView;
MavenOptionsView.viewId = 'mavenOptions';
function getNonce() {
    let t = '';
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        t += c.charAt(Math.floor(Math.random() * c.length));
    }
    return t;
}
//# sourceMappingURL=MavenOptionsView.js.map