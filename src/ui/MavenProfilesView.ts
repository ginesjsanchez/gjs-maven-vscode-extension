import * as vscode from 'vscode';
import * as path from 'path';
import { MavenProfileManager } from '../commands/MavenProfileManager';
import { readActivePom, declaredProfiles } from '../providers/PomModel';

export class MavenProfilesView implements vscode.WebviewViewProvider {
    public static readonly viewId = 'mavenProfiles';
    private webviewView?: vscode.WebviewView;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly profileManager: MavenProfileManager
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.webviewView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async msg => {
            switch (msg.command) {
                case 'ready':  this.sendProfiles(); break;
                case 'add':    if (msg.name?.trim()) { await this.profileManager.addProfile(msg.name.trim()); this.sendProfiles(); } break;
                case 'remove': if (msg.name?.trim()) { await this.profileManager.removeProfile(msg.name.trim()); this.sendProfiles(); } break;
                case 'clear':  await this.profileManager.clearProfiles(); this.sendProfiles(); break;
            }
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) { this.sendProfiles(); }
        });
    }

    refresh(): void {
        if (this.webviewView?.visible) { this.sendProfiles(); }
    }

    private sendProfiles(): void {
        // Los perfiles declarados son los del pom que se está mirando, no los de
        // todo el árbol: la ayuda sirve para no tener que abrir el fichero.
        // Los heredados de un pom padre no salen; para eso está help:all-profiles.
        const project = readActivePom();
        const pomPath = vscode.window.activeTextEditor?.document.uri.fsPath;

        this.webviewView?.webview.postMessage({
            command: 'update',
            profiles: this.profileManager.getActiveProfiles(),
            declared: project ? declaredProfiles(project) : null,
            pom: project && pomPath ? path.basename(path.dirname(pomPath)) : null
        });
    }

    private getHtml(): string {
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
.profile-list { display: flex; flex-direction: column; gap: 2px; min-height: 20px; }
.profile-item { display: flex; align-items: center; justify-content: space-between; background: var(--vscode-list-inactiveSelectionBackground); padding: 3px 6px; border-radius: 2px; }
.profile-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn-x { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 13px; padding: 0 2px; flex-shrink: 0; }
.btn-x:hover { color: var(--vscode-errorForeground); }
.empty { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 11px; padding: 2px 0; }
hr { border: none; border-top: 1px solid var(--vscode-widget-border, #444); margin: 10px 0; }
input { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, #555); padding: 3px 6px; font-size: var(--vscode-font-size); outline: none; border-radius: 2px; margin-bottom: 4px; }
input:focus { border-color: var(--vscode-focusBorder); }
button.primary { width: 100%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 6px; cursor: pointer; font-size: var(--vscode-font-size); border-radius: 2px; }
button.primary:hover { background: var(--vscode-button-hoverBackground); }
button.secondary { width: 100%; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 4px 6px; cursor: pointer; font-size: var(--vscode-font-size); border-radius: 2px; margin-top: 4px; }
button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.row { display: flex; gap: 4px; align-items: stretch; margin-bottom: 4px; }
.row input { flex: 1; min-width: 0; margin-bottom: 0; }
button.help { flex: 0 0 auto; width: 24px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; cursor: pointer; border-radius: 2px; font-size: var(--vscode-font-size); }
button.help:hover { background: var(--vscode-button-secondaryHoverBackground); }
button.help[aria-expanded="true"] { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.help-box { margin-top: 6px; border: 1px solid var(--vscode-widget-border, #444); border-radius: 2px; padding: 4px; }
.help-box.hidden { display: none; }
.help-title { font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
.declared { display: flex; flex-direction: column; gap: 2px; }
.declared-item { background: none; border: none; color: var(--vscode-foreground); text-align: left; cursor: pointer; padding: 3px 4px; border-radius: 2px; width: 100%; font-size: var(--vscode-font-size); font-family: var(--vscode-font-family); }
.declared-item:hover { background: var(--vscode-list-hoverBackground); }
.declared-item[disabled] { cursor: default; opacity: .6; }
.declared-item[disabled]:hover { background: none; }
.declared-name { display: block; }
.declared-meta { display: block; font-size: 11px; color: var(--vscode-descriptionForeground); }
.tick { color: var(--vscode-charts-green, #89d185); }
</style>
</head>
<body>

<div class="section-header"><h3>Active Profiles</h3></div>
<div class="profile-list" id="list">
    <span class="empty">No active profiles</span>
</div>
<button class="secondary" id="btn-clear-all">Remove all</button>

<hr>

<div class="section-header"><h3>Profile</h3></div>
<div class="row">
    <input id="inp" type="text" placeholder="Profile name..." />
    <button class="help" id="btn-help" aria-expanded="false" title="Profiles declared in this pom.xml">?</button>
</div>
<button class="primary" id="btn-add">Add</button>

<div class="help-box hidden" id="help">
    <div class="help-title" id="help-title">Declared in this pom.xml</div>
    <div class="declared" id="declared"></div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

vscode.postMessage({ command: 'ready' });

let state = { profiles: [], declared: null, pom: null };

window.addEventListener('message', e => {
    if (e.data.command !== 'update') { return; }
    state = e.data;
    render(state.profiles);
    renderDeclared();
});

// Los perfiles que declara el pom que se está mirando. Se piden con el botón
// para no ocupar sitio permanentemente en un panel tan estrecho.
function renderDeclared() {
    const title = document.getElementById('help-title');
    const box = document.getElementById('declared');

    if (!state.declared) {
        title.textContent = 'Declared profiles';
        box.innerHTML = '<span class="empty">Open a pom.xml to see its profiles</span>';
        return;
    }

    title.textContent = 'Declared in ' + esc(state.pom || 'this pom.xml');

    if (state.declared.length === 0) {
        box.innerHTML = '<span class="empty">This pom.xml declares no profiles</span>';
        return;
    }

    const active = state.profiles || [];
    box.innerHTML = state.declared.map(function (p) {
        const on = active.indexOf(p.id) >= 0;
        const meta = [p.activation, p.contributes].filter(Boolean).join(' — ');
        return '<button class="declared-item" data-name="' + esc(p.id) + '"' +
                   (on ? ' disabled title="Already active"' : ' title="Add to active profiles"') + '>' +
                   '<span class="declared-name">' + (on ? '<span class="tick">✓</span> ' : '') + esc(p.id) + '</span>' +
                   (meta ? '<span class="declared-meta">' + esc(meta) + '</span>' : '') +
               '</button>';
    }).join('');
}

document.getElementById('btn-help').addEventListener('click', function () {
    const help = document.getElementById('help');
    const btn = document.getElementById('btn-help');
    const show = help.classList.contains('hidden');
    help.classList.toggle('hidden', !show);
    btn.setAttribute('aria-expanded', String(show));
});

function render(profiles) {
    const list = document.getElementById('list');
    if (!profiles || profiles.length === 0) {
        list.innerHTML = '<span class="empty">No active profiles</span>';
        return;
    }
    list.innerHTML = profiles.map(p =>
        '<div class="profile-item">' +
            '<span class="profile-name">' + esc(p) + '</span>' +
            '<button class="btn-x" data-name="' + esc(p) + '" title="Remove">✕</button>' +
        '</div>'
    ).join('');
}

// Un listener por contenedor en lugar de uno por fila: se enganchan al arrancar
// y siguen valiendo por muchas veces que se reescriba el innerHTML.
document.getElementById('list').addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-x');
    if (!btn) { return; }
    vscode.postMessage({ command: 'remove', name: btn.getAttribute('data-name') });
});

document.getElementById('declared').addEventListener('click', function (e) {
    const btn = e.target.closest('.declared-item');
    if (!btn || btn.disabled) { return; }
    vscode.postMessage({ command: 'add', name: btn.getAttribute('data-name') });
});

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

function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let t = '';
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) { t += c.charAt(Math.floor(Math.random() * c.length)); }
    return t;
}
