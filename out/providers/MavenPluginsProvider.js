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
exports.MavenManagedDependenciesProvider = exports.MavenDependenciesProvider = exports.MavenManagedPluginsProvider = exports.MavenPluginsProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
function getActivePomPath() {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('pom.xml')) {
        return editor.document.uri.fsPath;
    }
    return undefined;
}
function readActivePom() {
    const pomPath = getActivePomPath();
    if (!pomPath) {
        return undefined;
    }
    try {
        return fs.readFileSync(pomPath, 'utf8');
    }
    catch {
        return undefined;
    }
}
/**
 * Extracts the content INSIDE a wrapper tag, excluding managed sections.
 * e.g. for dependencies: returns content of <dependencies> but NOT inside <dependencyManagement>
 */
function extractSection(text, tag, excludeWrapper) {
    if (excludeWrapper) {
        // Remove the excludeWrapper block first
        const exRe = new RegExp(`<${excludeWrapper}>[\\s\\S]*?<\\/${excludeWrapper}>`, 'g');
        text = text.replace(exRe, '');
    }
    const match = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
    return match ? match[0] : '';
}
/**
 * Extracts the content INSIDE a managed wrapper tag.
 * e.g. for managedDependencies: returns content of <dependencyManagement><dependencies>
 */
function extractManagedSection(text, wrapperTag, innerTag) {
    const wrapperMatch = text.match(new RegExp(`<${wrapperTag}>([\\s\\S]*?)<\\/${wrapperTag}>`));
    if (!wrapperMatch) {
        return '';
    }
    const innerMatch = wrapperMatch[1].match(new RegExp(`<${innerTag}>([\\s\\S]*?)<\\/${innerTag}>`));
    return innerMatch ? innerMatch[1] : '';
}
//  Plugins Provider 
class MavenPluginsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren() {
        const text = readActivePom();
        if (!text) {
            return [makeInfoItem('Open a pom.xml to see plugins')];
        }
        // Only plugins outside <pluginManagement>
        const section = extractSection(text, 'plugins', 'pluginManagement');
        return parsePlugins(section) || [makeInfoItem('No plugins configured')];
    }
}
exports.MavenPluginsProvider = MavenPluginsProvider;
//  Managed Plugins Provider 
class MavenManagedPluginsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren() {
        const text = readActivePom();
        if (!text) {
            return [makeInfoItem('Open a pom.xml to see managed plugins')];
        }
        const section = extractManagedSection(text, 'pluginManagement', 'plugins');
        return parsePlugins(section) || [makeInfoItem('No managed plugins configured')];
    }
}
exports.MavenManagedPluginsProvider = MavenManagedPluginsProvider;
//  Dependencies Provider 
class MavenDependenciesProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren() {
        const text = readActivePom();
        if (!text) {
            return [makeInfoItem('Open a pom.xml to see dependencies')];
        }
        // Only dependencies outside <dependencyManagement>
        const section = extractSection(text, 'dependencies', 'dependencyManagement');
        return parseDependencies(section) || [makeInfoItem('No dependencies declared')];
    }
}
exports.MavenDependenciesProvider = MavenDependenciesProvider;
//  Managed Dependencies Provider 
class MavenManagedDependenciesProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren() {
        const text = readActivePom();
        if (!text) {
            return [makeInfoItem('Open a pom.xml to see managed dependencies')];
        }
        const section = extractManagedSection(text, 'dependencyManagement', 'dependencies');
        return parseDependencies(section) || [makeInfoItem('No managed dependencies declared')];
    }
}
exports.MavenManagedDependenciesProvider = MavenManagedDependenciesProvider;
//  Parsers 
function parsePlugins(section) {
    const items = [];
    const re = /<plugin>([\s\S]*?)<\/plugin>/g;
    let m;
    while ((m = re.exec(section)) !== null) {
        const block = m[1];
        const g = (block.match(/<groupId>([^<]+)/) || [])[1] || 'org.apache.maven.plugins';
        const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
        const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
        const item = new vscode.TreeItem(a, vscode.TreeItemCollapsibleState.None);
        item.description = v;
        item.tooltip = `${g}:${a}:${v}`;
        item.iconPath = new vscode.ThemeIcon('extensions');
        items.push(item);
    }
    return items.length > 0 ? items : null;
}
function parseDependencies(section) {
    const items = [];
    const re = /<dependency>([\s\S]*?)<\/dependency>/g;
    let m;
    while ((m = re.exec(section)) !== null) {
        const block = m[1];
        const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
        const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
        const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
        const s = (block.match(/<scope>([^<]+)/) || [])[1] || 'compile';
        const item = new vscode.TreeItem(a, vscode.TreeItemCollapsibleState.None);
        item.description = `${v} [${s}]`;
        item.tooltip = `${g}:${a}:${v}`;
        item.iconPath = scopeIcon(s);
        items.push(item);
    }
    return items.length > 0 ? items : null;
}
function scopeIcon(scope) {
    const icons = {
        compile: 'library', provided: 'server', runtime: 'run',
        test: 'beaker', system: 'warning', import: 'file-symlink-file',
    };
    return new vscode.ThemeIcon(icons[scope] ?? 'library');
}
function makeInfoItem(label) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
//# sourceMappingURL=MavenPluginsProvider.js.map