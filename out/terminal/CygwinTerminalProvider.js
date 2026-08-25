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
exports.CygwinTerminalProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class CygwinTerminalProvider {
    activate(context) {
        this.registerProfile();
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gjsMaven.cygwinPath')) {
                this.registerProfile();
            }
        }));
    }
    /**
     * Registra el perfil de terminal de Cygwin, si no lo hay ya.
     *
     * Va por la API de configuración, no por el fichero. settings.json es del
     * usuario y admite comentarios (jsonc): leerlo con JSON.parse fallaba en
     * cuanto había uno, y reescribirlo entero con JSON.stringify se los habría
     * llevado por delante junto con el formato. La API fusiona sobre lo que ya
     * hay y respeta el resto del fichero.
     */
    registerProfile() {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const cygwinPath = config.get('cygwinPath', '').trim();
        if (!cygwinPath) {
            return;
        }
        const mintty = path.join(cygwinPath, 'bin', 'mintty.exe');
        const icon = path.join(cygwinPath, 'Cygwin-Terminal.ico');
        if (!fs.existsSync(mintty)) {
            vscode.window.showWarningMessage(`Gjs Maven: Cygwin terminal not found at "${mintty}". Check gjsMaven.cygwinPath.`);
            return;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return;
        }
        const terminal = vscode.workspace.getConfiguration('terminal.integrated');
        // Para decidir, el valor efectivo: si el perfil ya lo tiene puesto el
        // usuario en sus ajustes globales, no hay que duplicarlo en el workspace.
        const effective = terminal.get('profiles.windows', {});
        if (effective['Cygwin']) {
            return;
        }
        // Para escribir, solo el ámbito propio: con el valor efectivo
        // acabaríamos copiando los perfiles del usuario dentro del workspace.
        const scoped = {
            ...(terminal.inspect('profiles.windows')?.workspaceValue ?? {})
        };
        scoped['Cygwin'] = {
            path: mintty,
            args: ['-i', icon, '-'],
            env: {
                CHERE_INVOKING: '1',
                CYGWIN: 'nodosfilewarning'
            }
        };
        void terminal.update('profiles.windows', scoped, vscode.ConfigurationTarget.Workspace)
            .then(() => vscode.window.showInformationMessage('Gjs Maven: Cygwin terminal profile added. Select it from the terminal dropdown.'));
    }
}
exports.CygwinTerminalProvider = CygwinTerminalProvider;
//# sourceMappingURL=CygwinTerminalProvider.js.map