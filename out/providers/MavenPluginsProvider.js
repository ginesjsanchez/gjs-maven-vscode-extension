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
exports.MavenDependenciesProvider = exports.MavenPluginsProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
// ── Plugins Provider ──────────────────────────────────────────────────────────
class MavenPluginsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }
    async getChildren() {
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 10);
        if (poms.length === 0) {
            return [makeInfoItem('No pom.xml found in workspace')];
        }
        const pom = poms[0]; // Show first project's plugins
        try {
            const text = fs.readFileSync(pom.fsPath, 'utf8');
            const plugins = [];
            const re = /<plugin>([\s\S]*?)<\/plugin>/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                const block = m[1];
                const g = (block.match(/<groupId>([^<]+)/) || [])[1] || 'org.apache.maven.plugins';
                const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
                const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
                const item = new vscode.TreeItem(`${a}`, vscode.TreeItemCollapsibleState.None);
                item.description = `${g}:${v}`;
                item.iconPath = new vscode.ThemeIcon('extensions');
                item.tooltip = `${g}:${a}:${v}`;
                plugins.push(item);
            }
            return plugins.length > 0 ? plugins : [makeInfoItem('No plugins configured')];
        }
        catch {
            return [makeInfoItem('Could not read pom.xml')];
        }
    }
}
exports.MavenPluginsProvider = MavenPluginsProvider;
// ── Dependencies Provider ─────────────────────────────────────────────────────
class MavenDependenciesProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }
    async getChildren() {
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 10);
        if (poms.length === 0) {
            return [makeInfoItem('No pom.xml found')];
        }
        const pom = poms[0];
        try {
            const text = fs.readFileSync(pom.fsPath, 'utf8');
            const deps = [];
            const re = /<dependency>([\s\S]*?)<\/dependency>/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                const block = m[1];
                const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
                const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
                const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
                const s = (block.match(/<scope>([^<]+)/) || [])[1] || 'compile';
                const item = new vscode.TreeItem(a, vscode.TreeItemCollapsibleState.None);
                item.description = `${v} [${s}]`;
                item.tooltip = `${g}:${a}:${v}`;
                item.iconPath = this.scopeIcon(s);
                deps.push(item);
            }
            return deps.length > 0 ? deps : [makeInfoItem('No dependencies declared')];
        }
        catch {
            return [makeInfoItem('Could not read pom.xml')];
        }
    }
    scopeIcon(scope) {
        const icons = {
            compile: 'library',
            provided: 'server',
            runtime: 'run',
            test: 'beaker',
            system: 'warning',
            import: 'file-symlink-file',
        };
        return new vscode.ThemeIcon(icons[scope] ?? 'library');
    }
}
exports.MavenDependenciesProvider = MavenDependenciesProvider;
function makeInfoItem(label) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
//# sourceMappingURL=MavenPluginsProvider.js.map