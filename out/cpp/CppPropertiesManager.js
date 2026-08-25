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
exports.CppPropertiesManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const MavenProjectContext_1 = require("../context/MavenProjectContext");
/** Lo que publica nar-include-path, relativo al directorio del módulo. */
const GENERATED_RELATIVE = path.join('target', 'nar', 'c_cpp_properties.json');
/** Lo que lee la extensión de C/C++, relativo a la carpeta del workspace. */
const INSTALLED_RELATIVE = path.join('.vscode', 'c_cpp_properties.json');
const CPP_LANGUAGES = ['c', 'c++'];
/** Margen para que moverse rápido entre ficheros no dispare una escritura por salto. */
const SWITCH_DELAY_MS = 250;
const OVERWRITE_APPROVED = 'gjsMaven.cppProperties.overwriteApproved';
/**
 * Mantiene .vscode/c_cpp_properties.json apuntando al módulo en el que se está
 * trabajando, en proyectos multimódulo C/C++.
 *
 * La extensión no calcula includes: los toma tal cual del fichero que publica
 * el goal nar-include-path del nar-maven-plugin, que es quien conoce los
 * defines y el estándar del modo de compilación en curso.
 */
class CppPropertiesManager {
    constructor(context, mavenUpdate) {
        this.context = context;
        this.mavenUpdate = mavenUpdate;
        /** Módulos por los que ya se ha preguntado, para no insistir a cada salto. */
        this.notified = new Set();
    }
    activate() {
        this.context.subscriptions.push(MavenProjectContext_1.MavenProjectContext.onDidChangeActiveModule(module => this.schedule(module)));
        // Cualquier vía que regenere el fichero pasa por aquí: mvn lanzado desde
        // la extensión, desde una consola Cygwin o desde donde sea. Vigilar el
        // fichero evita tener que enumerar qué comandos lo tocan.
        const watcher = vscode.workspace.createFileSystemWatcher(`**/${GENERATED_RELATIVE.replace(/\\/g, '/')}`);
        watcher.onDidCreate(uri => this.onGenerated(uri));
        watcher.onDidChange(uri => this.onGenerated(uri));
        this.context.subscriptions.push(watcher);
        this.schedule(MavenProjectContext_1.MavenProjectContext.activeModule);
    }
    /** Regenerar es exactamente lo que hace Maven Update en un módulo C/C++. */
    async regenerate(module) {
        await this.mavenUpdate.execute(vscode.Uri.file(module.pomPath));
    }
    schedule(module) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => this.apply(module), SWITCH_DELAY_MS);
    }
    onGenerated(uri) {
        // <modulo>/target/nar/c_cpp_properties.json
        const projectDir = path.dirname(path.dirname(path.dirname(uri.fsPath)));
        if (projectDir !== MavenProjectContext_1.MavenProjectContext.activeModule?.projectDir) {
            return;
        }
        this.notified.delete(projectDir);
        this.schedule(MavenProjectContext_1.MavenProjectContext.activeModule);
    }
    async apply(module) {
        // Los módulos que no son C/C++ dejan la configuración como esté: al
        // editar un pom o una clase Java no hay por qué romper IntelliSense.
        if (!module || !CPP_LANGUAGES.includes(module.language ?? '')) {
            return;
        }
        const generated = path.join(module.projectDir, GENERATED_RELATIVE);
        if (!fs.existsSync(generated)) {
            await this.offerRegenerate(module);
            return;
        }
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(module.projectDir));
        if (!folder) {
            return;
        }
        const installed = path.join(folder.uri.fsPath, INSTALLED_RELATIVE);
        try {
            const contents = fs.readFileSync(generated, 'utf8');
            // Reescribir sin necesidad le cuesta a IntelliSense un reanálisis
            if (fs.existsSync(installed) && fs.readFileSync(installed, 'utf8') === contents) {
                return;
            }
            if (!await this.confirmOverwrite(installed)) {
                return;
            }
            fs.mkdirSync(path.dirname(installed), { recursive: true });
            fs.writeFileSync(installed, contents, 'utf8');
            console.log(`Gjs Maven VS Code Extension: c_cpp_properties.json <- ${module.projectDir}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`No se pudo actualizar c_cpp_properties.json: ${err.message}`);
        }
    }
    /**
     * El fichero es del usuario. Si ya había uno antes de que la extensión
     * empezara a gestionarlo, se pide permiso una vez por workspace.
     */
    async confirmOverwrite(installed) {
        if (this.context.workspaceState.get(OVERWRITE_APPROVED)) {
            return true;
        }
        if (fs.existsSync(installed)) {
            const choice = await vscode.window.showWarningMessage('Ya existe .vscode/c_cpp_properties.json. Gjs Maven pasará a sobrescribirlo con la ' +
                'configuración del módulo activo cada vez que cambies de módulo.', 'Sobrescribir', 'Dejarlo como está');
            if (choice !== 'Sobrescribir') {
                return false;
            }
        }
        await this.context.workspaceState.update(OVERWRITE_APPROVED, true);
        return true;
    }
    async offerRegenerate(module) {
        if (this.notified.has(module.projectDir)) {
            return;
        }
        this.notified.add(module.projectDir);
        const name = path.basename(module.projectDir);
        const choice = await vscode.window.showWarningMessage(`El módulo '${name}' no tiene calculado el includePath de C/C++. ` +
            'Maven Update lo genera sin compilar, refrescando antes sus librerías.', 'Maven Update', 'Ahora no');
        if (choice === 'Maven Update') {
            await this.regenerate(module);
        }
    }
}
exports.CppPropertiesManager = CppPropertiesManager;
//# sourceMappingURL=CppPropertiesManager.js.map