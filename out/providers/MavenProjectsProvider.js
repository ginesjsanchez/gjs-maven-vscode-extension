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
function parsePom(uri) {
    const text = fs.readFileSync(uri.fsPath, 'utf8');
    // Strip nested sections to avoid picking up child coords
    const stripped = text
        .replace(/<parent>[\s\S]*?<\/parent>/g, '')
        .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, '')
        .replace(/<plugins>[\s\S]*?<\/plugins>/g, '');
    const artifactId = (stripped.match(/<artifactId>([^<]+)/) || [])[1]?.trim() ?? path.basename(path.dirname(uri.fsPath));
    const groupId = (stripped.match(/<groupId>([^<]+)/) || [])[1]?.trim() ?? '';
    const version = (stripped.match(/<version>([^<]+)/) || [])[1]?.trim() ?? '';
    const packaging = (stripped.match(/<packaging>([^<]+)/) || [])[1]?.trim() ?? 'jar';
    const modules = [];
    const modulesMatch = text.match(/<modules>([\s\S]*?)<\/modules>/);
    if (modulesMatch) {
        const re = /<module>([^<]+)<\/module>/g;
        let m;
        while ((m = re.exec(modulesMatch[1])) !== null) {
            modules.push(m[1].trim());
        }
    }
    return { uri, artifactId, groupId, version, packaging, modules };
}
class MavenProjectsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.pomMap = new Map(); // fsPath -> PomInfo
        this.roots = [];
    }
    refresh() {
        this.pomMap.clear();
        this.roots = [];
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) { return element; }
    async getChildren(element) {
        if (!element) {
            await this.buildTree();
            return this.roots.map(p => new MavenProjectItem(p, true));
        }
        if (element.type === 'project') {
            const pom = this.pomMap.get(element.pomInfo.uri.fsPath);
            if (!pom) {
                return [];
            }
            const items = [];
            // Details
            items.push(new MavenProjectItem(pom, false, `groupId: ${pom.groupId}`, 'symbol-namespace'));
            items.push(new MavenProjectItem(pom, false, `version: ${pom.version}`, 'tag'));
            items.push(new MavenProjectItem(pom, false, `packaging: ${pom.packaging}`, 'archive'));
            // Child modules
            for (const mod of pom.modules) {
                const modPomPath = path.join(path.dirname(pom.uri.fsPath), mod, 'pom.xml');
                const childPom = this.pomMap.get(modPomPath);
                if (childPom) {
                    items.push(new MavenProjectItem(childPom, true));
                }
            }
            return items;
        }
        return [];
    }
    async buildTree() {
        const uris = await vscode.workspace.findFiles('**/pom.xml', '{**/node_modules/**,**/target/**,**/archetype-resources/**}', 50);
        for (const uri of uris) {
            try {
                const info = parsePom(uri);
                this.pomMap.set(uri.fsPath, info);
            }
            catch { /* skip unreadable */ }
        }
        // Determine roots: poms that are not a module of another pom
        const childPaths = new Set();
        for (const pom of this.pomMap.values()) {
            for (const mod of pom.modules) {
                const childPath = path.join(path.dirname(pom.uri.fsPath), mod, 'pom.xml');
                childPaths.add(childPath);
            }
        }
        this.roots = [];
        for (const pom of this.pomMap.values()) {
            if (!childPaths.has(pom.uri.fsPath)) {
                this.roots.push(pom);
            }
        }
        // Sort roots by artifactId
        this.roots.sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    }
}
exports.MavenProjectsProvider = MavenProjectsProvider;
class MavenProjectItem extends vscode.TreeItem {
    constructor(pomInfo, isProject, detailLabel, detailIcon) {
        super(isProject ? pomInfo.artifactId : (detailLabel ?? ''), vscode.TreeItemCollapsibleState.Collapsed);
        this.pomInfo = pomInfo;
        if (isProject) {
            this.type = 'project';
            this.description = pomInfo.version;
            this.tooltip = `${pomInfo.groupId}:${pomInfo.artifactId}:${pomInfo.version}`;
            this.iconPath = this.resolveIcon(pomInfo.packaging, pomInfo.modules.length > 0);
            this.contextValue = 'mavenProject';
            this.command = {
                command: 'vscode.open',
                title: 'Open pom.xml',
                arguments: [pomInfo.uri]
            };
        }
        else {
            this.type = 'detail';
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
            this.iconPath = new vscode.ThemeIcon(detailIcon ?? 'info');
            this.contextValue = 'mavenDetail';
        }
    }
    resolveIcon(packaging, hasModules) {
        if (packaging === 'pom' && hasModules) {
            return new vscode.ThemeIcon('folder-library');
        }
        else if (packaging === 'pom') {
            return new vscode.ThemeIcon('type-hierarchy');
        }
        else if (packaging === 'maven-archetype') {
            return new vscode.ThemeIcon('symbol-structure');
        }
        else {
            return new vscode.ThemeIcon('package');
        }
    }
}
exports.MavenProjectItem = MavenProjectItem;
//# sourceMappingURL=MavenProjectsProvider.js.map