"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MavenArchetypesView = void 0;
exports.parseArchetypeCatalog = parseArchetypeCatalog;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MavenProjectContext_1 = require("../context/MavenProjectContext");
function parseArchetypeCatalog(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const text = fs.readFileSync(filePath, 'utf8');
        const archetypes = [];
        const re = /<archetype>([\s\S]*?)<\/archetype>/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            const block = m[1];
            const groupId = (block.match(/<groupId>([^<]+)/) || [])[1]?.trim() ?? '';
            const artifactId = (block.match(/<artifactId>([^<]+)/) || [])[1]?.trim() ?? '';
            const version = (block.match(/<version>([^<]+)/) || [])[1]?.trim() ?? '';
            if (groupId && artifactId) {
                archetypes.push({ groupId, artifactId, version });
            }
        }
        return archetypes;
    }
    catch {
        return [];
    }
}
class MavenArchetypesView {
    constructor(context, archetypeRunner) {
        this.context = context;
        this.archetypeRunner = archetypeRunner;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this.webviewView = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case 'ready':
                    this.sendArchetypes();
                    break;
                case 'refresh':
                    //await this.archetypeRunner.crawlSync();
                    this.sendArchetypes();
                    break;
                case 'generate':
                    await vscode.commands.executeCommand('gjs-maven-vscode-extension.archetypeGenerate', msg.groupId, msg.artifactId, msg.version);
                    break;
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.sendArchetypes();
            }
        });
    }
    refresh() {
        if (this.webviewView?.visible) {
            this.sendArchetypes();
        }
    }
    sendArchetypes() {
        const localRepo = MavenProjectContext_1.MavenProjectContext.globalConfig.localRepository;
        const local = this.existsDir(localRepo) ? parseArchetypeCatalog(path.join(localRepo, 'archetype-catalog.xml')) : [];
        const global = this.existsDir(localRepo) ? parseArchetypeCatalog(path.join(localRepo, 'archetype-catalog-central.xml')) : [];
        this.webviewView?.webview.postMessage({ command: 'update', local, global });
    }
    existsDir(dir) {
        return dir ? fs.existsSync(dir) : false;
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
h3 { font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 6px; margin-top: 10px; }
h3:first-child { margin-top: 0; }
.search-box { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, #555); padding: 3px 6px; font-size: var(--vscode-font-size); outline: none; border-radius: 2px; margin-bottom: 4px; }
.search-box:focus { border-color: var(--vscode-focusBorder); }
.list { display: flex; flex-direction: column; gap: 1px; max-height: 200px; overflow-y: auto; }
.item { padding: 3px 6px; border-radius: 2px; cursor: pointer; font-family: monospace; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; min-height: 20px;}
.item:hover { background: var(--vscode-list-hoverBackground); }
.item.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.empty { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 11px; padding: 2px 0; }
.count { color: var(--vscode-descriptionForeground); font-size: 10px; margin-left: 6px; }
hr { border: none; border-top: 1px solid var(--vscode-widget-border, #444); margin: 10px 0; }
button { width: 100%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 6px; cursor: pointer; font-size: var(--vscode-font-size); border-radius: 2px; margin-top: 8px; }
button:hover { background: var(--vscode-button-hoverBackground); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>

<h3>Local Archetypes <span class="count" id="local-count"></span></h3>
<input class="search-box" id="search-local" type="text" placeholder="Filter..." />
<div class="list" id="local-list"><span class="empty">Loading...</span></div>

<hr>

<h3>Global Archetypes <span class="count" id="global-count"></span></h3>
<input class="search-box" id="search-global" type="text" placeholder="Filter..." />
<div class="list" id="global-list"><span class="empty">Loading...</span></div>

<button id="btn-refresh">Refresh</button>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let localData  = [];
let globalData = [];

vscode.postMessage({ command: 'ready' });

window.addEventListener('message', e => {
    if (e.data.command === 'update') {
        localData  = e.data.local  || [];
        globalData = e.data.global || [];
        renderList('local-list',  'local-count',  localData,  document.getElementById('search-local').value);
        renderList('global-list', 'global-count', globalData, document.getElementById('search-global').value);
        document.getElementById('btn-refresh').disabled = false;
        document.getElementById('btn-refresh').textContent = 'Refresh';
    }
});

function renderList(listId, countId, data, filter) {
    const list = document.getElementById(listId);
    const filtered = filter
        ? data.filter(a => (a.groupId + ':' + a.artifactId + ':' + a.version).toLowerCase().includes(filter.toLowerCase()))
        : data;
    document.getElementById(countId).textContent = '(' + filtered.length + ')';
    if (filtered.length === 0) {
        list.innerHTML = '<span class="empty">' + (data.length === 0 ? 'No archetypes found' : 'No matches') + '</span>';
        return;
    }
    list.innerHTML = filtered.map((a, i) =>
        '<div class="item" data-index="' + i + '" data-group="' + esc(a.groupId) + '" data-artifact="' + esc(a.artifactId) + '" data-version="' + esc(a.version) + '" title="' + esc(a.groupId + ':' + a.artifactId + ':' + a.version) + '">' +
            esc(a.groupId + ':' + a.artifactId + ':' + a.version) +
        '</div>'
    ).join('');
    list.querySelectorAll('.item').forEach(function(el) {
        el.addEventListener('dblclick', function() {
            vscode.postMessage({
                command: 'generate',
                groupId:    el.getAttribute('data-group'),
                artifactId: el.getAttribute('data-artifact'),
                version:    el.getAttribute('data-version')
            });
        });
        el.addEventListener('click', function() {
            list.querySelectorAll('.item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
        });
    });
}

document.getElementById('search-local').addEventListener('input', function() {
    renderList('local-list', 'local-count', localData, this.value);
});

document.getElementById('search-global').addEventListener('input', function() {
    renderList('global-list', 'global-count', globalData, this.value);
});

document.getElementById('btn-refresh').addEventListener('click', function() {
    this.disabled = true;
    this.textContent = 'Running archetype:crawl...';
    vscode.postMessage({ command: 'refresh' });
});

function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
    }
}
exports.MavenArchetypesView = MavenArchetypesView;
MavenArchetypesView.viewId = 'mavenArchetypes';
function getNonce() {
    let t = '';
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        t += c.charAt(Math.floor(Math.random() * c.length));
    }
    return t;
}
//# sourceMappingURL=MavenArchetypesView.js.map