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
exports.MavenProjectItem = exports.MavenProjectsProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class MavenProjectsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    async getChildren(element) {
        if (!element) {
            // Root: find all pom.xml files
            const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 50);
            return poms.map(uri => new MavenProjectItem(uri));
        }
        // Children: show groupId, artifactId, version from pom
        return element.getDetails();
    }
    getTreeItem(element) { return element; }
}
exports.MavenProjectsProvider = MavenProjectsProvider;
class MavenProjectItem extends vscode.TreeItem {
    constructor(pomUri) {
        const rel = vscode.workspace.asRelativePath(pomUri);
        const dir = path.dirname(rel);
        super(dir === '.' ? 'Root Project' : dir, vscode.TreeItemCollapsibleState.Collapsed);
        this.pomUri = pomUri;
        this.resourceUri = pomUri;
        this.contextValue = 'mavenProject';
        this.iconPath = new vscode.ThemeIcon('package');
        this.tooltip = pomUri.fsPath;
        this.command = {
            command: 'vscode.open',
            title: 'Open pom.xml',
            arguments: [pomUri]
        };
        // Parse name from pom
        try {
            const text = fs.readFileSync(pomUri.fsPath, 'utf8');
            const artifactId = (text.match(/<artifactId>([^<]+)<\/artifactId>/) || [])[1];
            const version = (text.match(/<version>([^<]+)<\/version>/) || [])[1];
            if (artifactId) {
                this.label = artifactId;
                this.description = version ?? '';
            }
        }
        catch { /* ignore */ }
    }
    async getDetails() {
        try {
            const text = fs.readFileSync(this.pomUri.fsPath, 'utf8');
            const items = [];
            const fields = [
                ['groupId', 'symbol-namespace'],
                ['artifactId', 'symbol-class'],
                ['version', 'tag'],
                ['packaging', 'archive'],
            ];
            for (const [field, icon] of fields) {
                const val = (text.match(new RegExp(`<${field}>([^<]+)<\/${field}>`)) || [])[1];
                if (val) {
                    items.push(new DetailItem(`${field}: ${val}`, icon));
                }
            }
            return items;
        }
        catch {
            return [];
        }
    }
}
exports.MavenProjectItem = MavenProjectItem;
class DetailItem extends vscode.TreeItem {
    constructor(label, icon) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'mavenDetail';
    }
}
//# sourceMappingURL=MavenProjectsProvider.js.map