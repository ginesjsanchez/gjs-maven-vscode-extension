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
/**
 * Filas que se envían al webview de una vez.
 *
 * El catálogo de central trae del orden de 70.000 arquetipos. Pintarlos todos
 * como nodos del DOM cuelga la vista, y volver a hacerlo en cada tecla del
 * filtro la remata; mandarlos enteros por postMessage son varios MB por envío.
 * Se filtra en la extensión y solo viaja lo que se ve.
 */
const MAX_ROWS = 200;
/** Coincidencias del filtro, recortadas a lo que se va a pintar. */
function select(all, filter) {
    const needle = filter.trim().toLowerCase();
    const matches = needle
        ? all.filter(a => `${a.groupId}:${a.artifactId}:${a.version}`.toLowerCase().includes(needle))
        : all;
    return { rows: matches.slice(0, MAX_ROWS), matches: matches.length, total: all.length };
}
class MavenArchetypesView {
    constructor(context, archetypeRunner) {
        this.context = context;
        this.archetypeRunner = archetypeRunner;
        /** Catálogos ya leídos. Releerlos en cada envío no aporta nada. */
        this.local = [];
        this.global = [];
        this.loaded = false;
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
                case 'filter':
                    this.sendArchetypes(msg.local, msg.global);
                    break;
                case 'refresh':
                    // archetype:crawl reconstruye el catálogo LOCAL recorriendo el
                    // repositorio. El de central no lo toca: ese se descarga aparte.
                    await this.archetypeRunner.crawlSync();
                    this.loaded = false;
                    this.sendArchetypes(msg.local, msg.global);
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
    /** Lee los catálogos una vez; sale con false si aún no se sabe dónde están. */
    load() {
        const localRepo = MavenProjectContext_1.MavenProjectContext.globalConfig.localRepository;
        if (!this.existsDir(localRepo)) {
            return false;
        }
        if (this.loaded) {
            return true;
        }
        this.local = parseArchetypeCatalog(path.join(localRepo, 'archetype-catalog.xml'));
        this.global = parseArchetypeCatalog(path.join(localRepo, 'archetype-catalog-central.xml'));
        this.loaded = true;
        return true;
    }
    sendArchetypes(localFilter = '', globalFilter = '') {
        if (!this.webviewView) {
            return;
        }
        if (!this.load()) {
            // Sin repositorio local no hay catálogos que leer. Distinguir "aún no
            // se sabe" de "Maven no pudo decirlo" evita dejar el panel diciendo
            // que está resolviendo algo que ya falló.
            this.webviewView.webview.postMessage({
                command: 'pending',
                reason: MavenProjectContext_1.MavenProjectContext.globalConfig.localRepositoryError
            });
            return;
        }
        this.webviewView.webview.postMessage({
            command: 'update',
            local: select(this.local, localFilter),
            global: select(this.global, globalFilter)
        });
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

<button id="btn-refresh" title="Runs archetype:crawl to rebuild the local catalog from the local repository. The central catalog is not touched.">Refresh local catalog</button>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

vscode.postMessage({ command: 'ready' });

window.addEventListener('message', e => {
    if (e.data.command === 'pending') {
        setBusy(false);
        const text = e.data.reason
            ? 'Maven could not resolve the local repository: ' + e.data.reason
            : 'Resolving the local repository...';
        setMessage('local-list',  'local-count',  text);
        setMessage('global-list', 'global-count', text);
        return;
    }
    if (e.data.command !== 'update') { return; }
    renderList('local-list',  'local-count',  e.data.local);
    renderList('global-list', 'global-count', e.data.global);
    setBusy(false);
});

function filters() {
    return {
        local:  document.getElementById('search-local').value,
        global: document.getElementById('search-global').value
    };
}

// El filtrado lo hace la extensión: el catálogo de central ronda los 70.000
// arquetipos y ni cabe cómodamente en un postMessage ni se puede pintar entero.
let pending = null;
function requestFilter() {
    clearTimeout(pending);
    pending = setTimeout(function () {
        const f = filters();
        vscode.postMessage({ command: 'filter', local: f.local, global: f.global });
    }, 150);
}

function setMessage(listId, countId, text) {
    document.getElementById(countId).textContent = '';
    document.getElementById(listId).innerHTML = '<span class="empty">' + esc(text) + '</span>';
}

function renderList(listId, countId, data) {
    const list = document.getElementById(listId);
    const count = document.getElementById(countId);

    if (!data || data.total === 0) {
        setMessage(listId, countId, 'No archetypes found');
        return;
    }
    if (data.matches === 0) {
        setMessage(listId, countId, 'No matches (' + data.total + ' available)');
        return;
    }

    // Decir cuántos hay de verdad, no cuántos caben
    count.textContent = data.matches > data.rows.length
        ? '(' + data.rows.length + ' of ' + data.matches + ' — refine the filter)'
        : '(' + data.matches + ')';

    list.innerHTML = data.rows.map(function (a) {
        const coords = a.groupId + ':' + a.artifactId + ':' + a.version;
        return '<div class="item" data-group="' + esc(a.groupId) + '" data-artifact="' + esc(a.artifactId) +
               '" data-version="' + esc(a.version) + '" title="' + esc(coords) + '">' + esc(coords) + '</div>';
    }).join('');
}

/**
 * Un único listener por lista, no uno por fila.
 *
 * Se enganchaban dos por fila y se rehacían en cada filtrado: con el tope de
 * filas son 400 registros cada vez que tecleas. Con delegación se enganchan dos
 * en total, al arrancar, y sobreviven a cualquier reescritura del innerHTML.
 */
function wireList(listId) {
    const list = document.getElementById(listId);

    list.addEventListener('click', function (e) {
        const el = e.target.closest('.item');
        if (!el) { return; }
        list.querySelectorAll('.item.selected').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
    });

    list.addEventListener('dblclick', function (e) {
        const el = e.target.closest('.item');
        if (!el) { return; }
        vscode.postMessage({
            command: 'generate',
            groupId:    el.getAttribute('data-group'),
            artifactId: el.getAttribute('data-artifact'),
            version:    el.getAttribute('data-version')
        });
    });
}

wireList('local-list');
wireList('global-list');

function setBusy(busy) {
    const btn = document.getElementById('btn-refresh');
    btn.disabled = busy;
    btn.textContent = busy ? 'Running archetype:crawl...' : 'Refresh local catalog';
}

document.getElementById('search-local').addEventListener('input', requestFilter);
document.getElementById('search-global').addEventListener('input', requestFilter);

document.getElementById('btn-refresh').addEventListener('click', function () {
    setBusy(true);
    const f = filters();
    vscode.postMessage({ command: 'refresh', local: f.local, global: f.global });
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