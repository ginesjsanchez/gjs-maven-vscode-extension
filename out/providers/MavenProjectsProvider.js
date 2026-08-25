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
/**
 * Clave estable para el mapa de poms. En Windows las rutas no distinguen
 * mayúsculas, y basta con que una venga con 'c:' y otra con 'C:' para que un
 * módulo deje de encontrar a su padre.
 */
function key(p) {
    const normalized = path.normalize(p);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
/**
 * Pom al que apunta un <module>. Maven admite tanto el directorio como el
 * fichero directamente (`../otro/pom.xml`), y rutas relativas hacia arriba.
 */
function modulePomPath(parentPomPath, mod) {
    const target = path.resolve(path.dirname(parentPomPath), mod);
    return target.toLowerCase().endsWith('.xml') ? target : path.join(target, 'pom.xml');
}
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
    // Todos los bloques <modules>, no solo el primero: un pom puede declarar
    // módulos adicionales dentro de un <profile>.
    const modules = [];
    const blocks = text.matchAll(/<modules>([\s\S]*?)<\/modules>/g);
    for (const block of blocks) {
        for (const m of block[1].matchAll(/<module>([^<]+)<\/module>/g)) {
            const mod = m[1].trim();
            if (mod && !modules.includes(mod)) {
                modules.push(mod);
            }
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
            const pom = this.pomMap.get(key(element.pomInfo.uri.fsPath));
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
                const childPom = this.pomMap.get(key(modulePomPath(pom.uri.fsPath, mod)));
                if (childPom) {
                    items.push(new MavenProjectItem(childPom, true));
                }
                else {
                    // Declarado en <modules> pero sin pom en el workspace: antes
                    // desaparecía en silencio y el árbol mentía sin decirlo.
                    items.push(new MavenProjectItem(pom, false, `módulo no encontrado: ${mod}`, 'warning'));
                }
            }
            return items;
        }
        return [];
    }
    async buildTree() {
        if (this.pomMap.size > 0) {
            return;
        } // ya construido; refresh() lo vacía
        // Sin límite de resultados. Lo había en 50, y un árbol con más poms se
        // truncaba por donde cayera: findFiles no devuelve en orden jerárquico,
        // así que unos módulos se quedaban sin cargar y otros aparecían como
        // raíces por no haberse cargado su padre. Medido en gjs: 120 poms.
        const uris = await vscode.workspace.findFiles('**/pom.xml', '{**/node_modules/**,**/target/**,**/archetype-resources/**}');
        for (const uri of uris) {
            try {
                this.pomMap.set(key(uri.fsPath), parsePom(uri));
            }
            catch { /* skip unreadable */ }
        }
        // Determine roots: poms that are not a module of another pom
        const childPaths = new Set();
        for (const pom of this.pomMap.values()) {
            for (const mod of pom.modules) {
                childPaths.add(key(modulePomPath(pom.uri.fsPath, mod)));
            }
        }
        this.roots = [];
        for (const pom of this.pomMap.values()) {
            if (!childPaths.has(key(pom.uri.fsPath))) {
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
            // La ruta, además de las coordenadas: dos módulos pueden declarar el
            // mismo artifactId por un copia-pega, y sin el fichero delante eso
            // parece un duplicado del árbol en vez de un error del pom.
            this.tooltip = new vscode.MarkdownString(`**${pomInfo.groupId}:${pomInfo.artifactId}:${pomInfo.version}**\n\n` +
                `\`${pomInfo.uri.fsPath}\``);
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