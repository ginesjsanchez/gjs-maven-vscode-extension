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
exports.HeaderAssociationManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const MavenProjectContext_1 = require("../context/MavenProjectContext");
/**
 * Claves de files.associations escritas por la extensión, con el módulo del que
 * salió cada una. Se guarda en workspaceState para poder distinguirlas de las
 * del usuario y retirarlas cuando el módulo deja de existir o de ser C.
 */
const OWNED_KEYS = 'gjsMaven.headerAssociations.owned';
/**
 * Asocia las cabeceras de los módulos en C con el lenguaje 'c'.
 *
 * VS Code trae .h asociado a 'cpp' de serie (lo declara su extensión cpp
 * integrada, que reparte .c/.i a 'c' y todo lo demás —incluido .h— a 'cpp'),
 * así que en un módulo de C puro las cabeceras se abren en modo C++ antes de
 * que cpptools llegue a opinar. Como aquí sí sabemos el lenguaje del módulo,
 * vía gjs.source.language, se corrige con files.associations.
 *
 * A diferencia de c_cpp_properties.json, settings.json es un fichero del
 * usuario: nunca se sobrescribe entero, solo se añaden y quitan las claves
 * propias sobre lo que ya haya.
 */
class HeaderAssociationManager {
    constructor(context) {
        this.context = context;
    }
    activate() {
        if (!this.enabled()) {
            return;
        }
        this.context.subscriptions.push(MavenProjectContext_1.MavenProjectContext.onDidChangeActiveModule(module => void this.apply(module)));
        void this.reconcile();
        void this.apply(MavenProjectContext_1.MavenProjectContext.activeModule);
    }
    enabled() {
        return vscode.workspace.getConfiguration('gjsMaven').get('cpp.associateHeaders', true);
    }
    /**
     * Asegura que el módulo activo tiene —o no tiene— su asociación, según su
     * lenguaje. Los módulos se van cubriendo a medida que se visitan: resolver
     * el lenguaje de todos por adelantado costaría una llamada a Maven por
     * módulo, que en un árbol grande es inaceptable.
     */
    async apply(module) {
        if (!module || !this.enabled()) {
            return;
        }
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(module.projectDir));
        if (!folder) {
            return;
        }
        const key = this.keyFor(folder.uri.fsPath, module.projectDir);
        const owned = this.owned();
        const isC = module.language === 'c';
        const scoped = this.scopedAssociations(folder.uri);
        const next = { ...scoped };
        if (isC) {
            next[key] = 'c';
        }
        else if (key in owned) {
            // El módulo dejó de ser C: el pom cambió de gjs.source.language
            delete next[key];
        }
        // Aprovechar el paso para limpiar claves propias de módulos ya inexistentes
        const stale = this.staleKeys(owned, next);
        for (const each of stale) {
            delete next[each];
        }
        if (this.same(scoped, next)) {
            return;
        }
        await this.write(next, folder.uri);
        const record = { ...owned };
        for (const each of stale) {
            delete record[each];
        }
        if (isC) {
            record[key] = module.projectDir;
        }
        else {
            delete record[key];
        }
        await this.context.workspaceState.update(OWNED_KEYS, record);
        console.log(`Gjs Maven VS Code Extension: files.associations ${isC ? '+' : '-'} ${key}`);
    }
    /** Retira las claves propias cuyo módulo ya no está. */
    async reconcile() {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const scoped = this.scopedAssociations(folder.uri);
            const owned = this.owned();
            const stale = this.staleKeys(owned, scoped);
            if (stale.length === 0) {
                continue;
            }
            const next = { ...scoped };
            const record = { ...owned };
            for (const each of stale) {
                delete next[each];
                delete record[each];
            }
            await this.write(next, folder.uri);
            await this.context.workspaceState.update(OWNED_KEYS, record);
            console.log(`Gjs Maven VS Code Extension: files.associations limpia ${stale.length} entrada(s)`);
        }
    }
    /** Claves propias presentes en la configuración cuyo módulo ya no tiene pom. */
    staleKeys(owned, associations) {
        return Object.keys(owned).filter(key => key in associations && !fs.existsSync(path.join(owned[key], 'pom.xml')));
    }
    /**
     * Patrón relativo a la carpeta del workspace, no solo el nombre del módulo:
     * en un árbol grande es fácil que dos módulos compartan nombre de directorio.
     */
    keyFor(folderDir, projectDir) {
        const relative = path.relative(folderDir, projectDir).replace(/\\/g, '/');
        return relative ? `**/${relative}/**/*.h` : '**/*.h';
    }
    owned() {
        return { ...this.context.workspaceState.get(OWNED_KEYS, {}) };
    }
    /**
     * Solo el valor del ámbito en el que escribimos. Con get() vendría el valor
     * efectivo, que incluye los ajustes de usuario, y al reescribirlo los
     * copiaríamos dentro del workspace.
     */
    scopedAssociations(folderUri) {
        const info = vscode.workspace.getConfiguration('files', folderUri)
            .inspect('associations');
        const value = this.target() === vscode.ConfigurationTarget.WorkspaceFolder
            ? info?.workspaceFolderValue
            : info?.workspaceValue;
        return { ...(value ?? {}) };
    }
    async write(associations, folderUri) {
        const value = Object.keys(associations).length > 0 ? associations : undefined;
        await vscode.workspace.getConfiguration('files', folderUri)
            .update('associations', value, this.target());
    }
    target() {
        const folders = vscode.workspace.workspaceFolders ?? [];
        return folders.length > 1
            ? vscode.ConfigurationTarget.WorkspaceFolder
            : vscode.ConfigurationTarget.Workspace;
    }
    same(a, b) {
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
    }
}
exports.HeaderAssociationManager = HeaderAssociationManager;
//# sourceMappingURL=HeaderAssociationManager.js.map