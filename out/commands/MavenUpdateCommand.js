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
exports.MavenUpdateCommand = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const MavenProjectContext_1 = require("../context/MavenProjectContext");
/**
 * El equivalente al "Maven Update" de Eclipse: pone al día lo que el proyecto
 * necesita para que el IDE lo entienda, sin compilarlo.
 *
 * Según el lenguaje del módulo:
 *  - Java y demás: copia y desempaqueta las dependencias.
 *  - C/C++: refresca las librerías nativas y recalcula el includePath. Los
 *    goals del nar-maven-plugin que hacen ambas cosas (nar-download,
 *    nar-unpack y nar-include-path) están atados a fases anteriores a compile,
 *    así que se llega hasta process-sources y ni un paso más: el objetivo es
 *    poder entender un proyecto que todavía no compila.
 */
class MavenUpdateCommand {
    constructor(runner) {
        this.runner = runner;
    }
    async execute(targetPomUri) {
        const channel = MavenUpdateCommand.getOutputChannel();
        try {
            const projectDir = path.dirname(targetPomUri.fsPath);
            // PASO 0: Ver el lenguaje (resuelto y cacheado por el contexto)
            const language = await MavenProjectContext_1.MavenProjectContext.getLanguage(projectDir);
            channel.appendLine(`🔍 language = '${language ?? '<sin definir>'}'`);
            if (language === 'c' || language === 'c++') {
                channel.appendLine("⏳ Refrescando librerías nativas y recalculando el includePath...");
                await this.runner.runAndWait('process-sources', projectDir, channel);
                // El c_cpp_properties.json generado lo recoge CppPropertiesManager,
                // que vigila el fichero.
            }
            else {
                channel.appendLine("⏳ Resolviendo dependencias Maven...");
                const cmdCopy = `dependency:copy-dependencies -DincludeTypes="jar,zip,tgz,gz,pyz"`;
                const cmdUnpack = `dependency:unpack-dependencies -DincludeTypes="jar,zip,tgz,gz,pyz" -DoutputDirectory=target/unpacked`;
                // PASO 1: Resolver dependencias con Maven
                await this.runner.runAndWait(cmdCopy, projectDir, channel);
                // PASO 2: Desempaquetar headers (zips con includes)
                channel.appendLine("📦 Desempaquetando dependencias...");
                await this.runner.run(cmdUnpack, projectDir);
            }
            channel.appendLine("✅ Maven Update completado.");
            vscode.window.showInformationMessage("Maven Update: dependencias actualizadas.");
        }
        catch (err) {
            channel.appendLine(`❌ Error: ${err.message}`);
            vscode.window.showErrorMessage(`Maven Update falló: ${err.message}`);
        }
    }
    async resolveIncludePaths(projectDir) {
        const paths = [];
        const includesDir = path.join(projectDir, 'target', 'includes');
        if (!fs.existsSync(includesDir))
            return paths;
        function walk(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.name === 'include') {
                    paths.push(fullPath); // la encontramos, no seguimos bajando
                }
                else {
                    walk(fullPath); // seguir buscando más abajo
                }
            }
        }
        walk(includesDir);
        return paths;
    }
    static getOutputChannel() {
        if (!MavenUpdateCommand._channel) {
            MavenUpdateCommand._channel = vscode.window.createOutputChannel('MavenUpdateCommand');
            MavenUpdateCommand._channel.show(true);
        }
        return MavenUpdateCommand._channel;
    }
}
exports.MavenUpdateCommand = MavenUpdateCommand;
//# sourceMappingURL=MavenUpdateCommand.js.map