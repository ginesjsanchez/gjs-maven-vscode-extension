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
exports.MavenPropertiesProvider = void 0;
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
//  Plugins Provider 
class MavenPropertiesProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren() {
        const text = readActivePom();
        if (!text) {
            return [makeInfoItem('Open a pom.xml to see properties')];
        }
        // Only plugins outside <pluginManagement>
        const section = extractSection(text, 'properties').replace("<properties>", "").replace("</properties>", "");
        return parseProperties(section) || [makeInfoItem('No properties configured')];
    }
}
exports.MavenPropertiesProvider = MavenPropertiesProvider;
//  Parsers 
function parseProperties(section) {
    const items = [];
    const re = /<!--[\s\S]*?-->|<([a-zA-Z0-9._-]+)>([\s\S]*?)<\/\1>/g;
    let m;
    while ((m = re.exec(section)) !== null) {
        if (!m[1]) {
            continue;
        } // es un comentario, saltarif (!m[1]) { continue; } // es un comentario, saltar 
        const name = m[1];
        const value = m[2];
        const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None);
        item.description = value;
        item.tooltip = `${name}`;
        item.iconPath = new vscode.ThemeIcon('symbol-property');
        items.push(item);
    }
    return items.length > 0 ? items : null;
}
function makeInfoItem(label) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
//# sourceMappingURL=MavenPropertiesProvider.js.map