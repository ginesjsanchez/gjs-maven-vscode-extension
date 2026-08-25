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
exports.ModuleLanguageStatus = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const MavenProjectContext_1 = require("../context/MavenProjectContext");
/** Lo que publica nar-include-path, relativo al directorio del módulo. */
const GENERATED_RELATIVE = path.join('target', 'nar', 'c_cpp_properties.json');
const CPP_LANGUAGES = ['c', 'c++'];
/** Nombre presentable de los lenguajes que maneja la extensión. */
const LABELS = {
    'c': 'C',
    'c++': 'C++',
    'java': 'Java',
    'python': 'Python'
};
/**
 * Entrada propia en el panel Editor Language Status, con el módulo Maven al
 * que pertenece el fichero que se está editando y su lenguaje.
 *
 * El panel lo alimentan las extensiones de lenguaje, y sobre un .h lo que
 * dicen es una conjetura: cpptools reparte C y C++ por heurística. Aquí el
 * lenguaje no se adivina, sale de gjs.source.language del pom efectivo, que es
 * la misma fuente con la que se arma el includePath y la asociación de las
 * cabeceras. Publicarlo deja las tres cosas contrastables desde el editor.
 *
 * El selector se reapunta al módulo activo en cada salto, así que la entrada
 * solo aparece en los ficheros de los que puede responder.
 */
class ModuleLanguageStatus {
    constructor(context) {
        this.context = context;
    }
    activate() {
        this.context.subscriptions.push(this, MavenProjectContext_1.MavenProjectContext.onDidChangeActiveModule(() => this.refresh()), vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gjsMaven.showLanguageStatus')) {
                this.refresh();
            }
        }));
        // Generar el includePath no cambia el módulo activo, pero sí lo que hay
        // que decir de él: de "sin calcular" a resuelto.
        const watcher = vscode.workspace.createFileSystemWatcher(`**/${GENERATED_RELATIVE.replace(/\\/g, '/')}`);
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        this.context.subscriptions.push(watcher);
        this.refresh();
    }
    enabled() {
        return vscode.workspace.getConfiguration('gjsMaven').get('showLanguageStatus', true);
    }
    refresh() {
        const module = MavenProjectContext_1.MavenProjectContext.activeModule;
        if (!this.enabled() || !module) {
            this.hide();
            return;
        }
        const item = this.ensure();
        // Ceñir la entrada al módulo activo. Un fichero de fuera —un settings.json
        // suelto— deja de casar y la entrada desaparece, en vez de atribuirle el
        // último módulo visitado, que el contexto conserva a propósito.
        item.selector = { scheme: 'file', pattern: new vscode.RelativePattern(module.projectDir, '**/*') };
        item.text = this.textFor(module);
        if (CPP_LANGUAGES.includes(module.language ?? '')) {
            this.describeCpp(item, module);
        }
        else {
            this.describePom(item, module);
        }
    }
    textFor(module) {
        const name = module.artifactId ?? path.basename(module.projectDir);
        const language = module.language;
        return language ? `${name} (${LABELS[language] ?? language})` : name;
    }
    /**
     * En C/C++ el dato interesante es si el módulo tiene calculado su
     * includePath, porque de eso depende que IntelliSense acierte.
     */
    describeCpp(item, module) {
        const generated = fs.existsSync(path.join(module.projectDir, GENERATED_RELATIVE));
        item.severity = generated
            ? vscode.LanguageStatusSeverity.Information
            : vscode.LanguageStatusSeverity.Warning;
        item.detail = generated ? 'gjs.source.language' : 'includePath sin calcular';
        item.command = {
            title: 'Maven Update',
            tooltip: generated
                ? 'Recalcular el includePath del módulo y refrescar sus librerías'
                : 'Generar el includePath del módulo, sin compilar',
            command: 'gjs-maven-vscode-extension.mavenUpdate',
            arguments: [vscode.Uri.file(module.pomPath)]
        };
    }
    /** Fuera de C/C++ no hay nada que recalcular: lo útil es llegar al pom. */
    describePom(item, module) {
        item.severity = vscode.LanguageStatusSeverity.Information;
        item.detail = module.language ? 'gjs.source.language' : 'sin gjs.source.language';
        item.command = {
            title: 'Abrir pom.xml',
            tooltip: module.language
                ? 'Abrir el pom del módulo, donde se declara o se hereda el lenguaje'
                : 'Abrir el pom del módulo, que no define gjs.source.language',
            command: 'vscode.open',
            arguments: [vscode.Uri.file(module.pomPath)]
        };
    }
    ensure() {
        if (!this.item) {
            this.item = vscode.languages.createLanguageStatusItem('gjsMaven.module', []);
            this.item.name = 'GJS Maven';
        }
        return this.item;
    }
    hide() {
        this.item?.dispose();
        this.item = undefined;
    }
    dispose() {
        this.hide();
    }
}
exports.ModuleLanguageStatus = ModuleLanguageStatus;
//# sourceMappingURL=ModuleLanguageStatus.js.map