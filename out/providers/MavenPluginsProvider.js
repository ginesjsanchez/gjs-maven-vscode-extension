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
const PomModel_1 = require("./PomModel");
/**
 * Los cuatro paneles son el mismo panel con otra sección y otro icono, así que
 * comparten implementación. Cada fila es un elemento del pom; sus hijos, si los
 * tiene, son lo que aporta cada perfil.
 */
class PomSectionProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren(element) {
        if (element instanceof PomModel_1.PomEntryItem) {
            return element.entry.profiles.map(v => new PomModel_1.PomVariantItem(v));
        }
        if (element) {
            return [];
        }
        const project = (0, PomModel_1.readActivePom)();
        if (!project) {
            return [(0, PomModel_1.makeInfoItem)(this.noPomMessage)];
        }
        const entries = (0, PomModel_1.collect)(project, this.section);
        if (entries.length === 0) {
            return [(0, PomModel_1.makeInfoItem)(this.emptyMessage)];
        }
        return entries.map(e => new PomModel_1.PomEntryItem(e, this.iconFor(e)));
    }
    /** Por defecto el icono de la sección; las dependencias lo afinan por scope. */
    iconFor(_entry) {
        return new vscode.ThemeIcon(this.icon);
    }
}
//  Plugins
class MavenPluginsProvider extends PomSectionProvider {
    constructor() {
        super(...arguments);
        this.section = 'plugins';
        this.icon = 'extensions';
        this.emptyMessage = 'No plugins configured';
        this.noPomMessage = 'Open a pom.xml to see plugins';
    }
}
exports.MavenPluginsProvider = MavenPluginsProvider;
class MavenManagedPluginsProvider extends PomSectionProvider {
    constructor() {
        super(...arguments);
        this.section = 'managedPlugins';
        this.icon = 'extensions';
        this.emptyMessage = 'No managed plugins configured';
        this.noPomMessage = 'Open a pom.xml to see managed plugins';
    }
}
exports.MavenManagedPluginsProvider = MavenManagedPluginsProvider;
//  Dependencies
class DependencyProvider extends PomSectionProvider {
    constructor() {
        super(...arguments);
        this.icon = 'library';
    }
    iconFor(entry) {
        // El scope viaja dentro del valor mostrado, entre corchetes
        const value = entry.base?.value ?? entry.profiles[0]?.value ?? '';
        const scope = (value.match(/\[([^\]]+)\]/) || [])[1] ?? 'compile';
        return scopeIcon(scope);
    }
}
class MavenDependenciesProvider extends DependencyProvider {
    constructor() {
        super(...arguments);
        this.section = 'dependencies';
        this.emptyMessage = 'No dependencies declared';
        this.noPomMessage = 'Open a pom.xml to see dependencies';
    }
}
exports.MavenDependenciesProvider = MavenDependenciesProvider;
class MavenManagedDependenciesProvider extends DependencyProvider {
    constructor() {
        super(...arguments);
        this.section = 'managedDependencies';
        this.emptyMessage = 'No managed dependencies declared';
        this.noPomMessage = 'Open a pom.xml to see managed dependencies';
    }
}
exports.MavenManagedDependenciesProvider = MavenManagedDependenciesProvider;
function scopeIcon(scope) {
    const icons = {
        compile: 'library', provided: 'server', runtime: 'run',
        test: 'beaker', system: 'warning', import: 'file-symlink-file',
    };
    return new vscode.ThemeIcon(icons[scope] ?? 'library');
}
//# sourceMappingURL=MavenPluginsProvider.js.map