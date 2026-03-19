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
exports.MavenParentProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class MavenParentProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
            return [makeInfoItem('Open a pom.xml to see parent')];
        }
        let text;
        try {
            text = fs.readFileSync(editor.document.uri.fsPath, 'utf8');
        }
        catch {
            return [makeInfoItem('Could not read pom.xml')];
        }
        const parentMatch = text.match(/<parent>([\s\S]*?)<\/parent>/);
        if (!parentMatch) {
            return [makeInfoItem('No parent POM declared')];
        }
        const block = parentMatch[1];
        const groupId = (block.match(/<groupId>([^<]+)/) || [])[1] ?? '';
        const artifactId = (block.match(/<artifactId>([^<]+)/) || [])[1] ?? '';
        const version = (block.match(/<version>([^<]+)/) || [])[1] ?? '';
        const relative = (block.match(/<relativePath>([^<]+)/) || [])[1] ?? '';
        const items = [];
        items.push(makeCoordItem('groupId', groupId, 'symbol-namespace'));
        items.push(makeCoordItem('artifactId', artifactId, 'symbol-class'));
        items.push(makeCoordItem('version', version, 'tag'));
        if (relative) {
            items.push(makeCoordItem('relativePath', relative, 'file-symlink-file'));
        }
        return items;
    }
}
exports.MavenParentProvider = MavenParentProvider;
function makeCoordItem(label, value, icon) {
    const item = new vscode.TreeItem(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(icon);
    item.tooltip = value;
    return item;
}
function makeInfoItem(label) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
//# sourceMappingURL=MavenParentProvider.js.map