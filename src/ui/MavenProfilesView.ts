import * as vscode from 'vscode';
import { MavenProfileManager } from '../commands/MavenProfileManager';

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
        this.webviewView?.webview.postMessage({
            command: 'update',
            profiles: this.profileManager.getActiveProfiles()
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
<input id="inp" type="text" placeholder="Profile name..." />
<button class="primary" id="btn-add">Add</button>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

vscode.postMessage({ command: 'ready' });

window.addEventListener('message', e => {
    if (e.data.command === 'update') { render(e.data.profiles); }
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

    // Attach listeners to each ✕ button
    list.querySelectorAll('.btn-x').forEach(function(btn) {
        btn.addEventListener('click', function() {
            vscode.postMessage({ command: 'remove', name: btn.getAttribute('data-name') });
        });
    });
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
