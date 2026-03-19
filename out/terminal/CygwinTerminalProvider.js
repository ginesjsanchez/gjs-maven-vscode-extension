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
    registerProfile() {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const cygwinPath = config.get('cygwinPath', '').trim();
        if (!cygwinPath) {
            return;
        }
        const bashExe = path.join(cygwinPath, 'bin', 'mintty.exe');
        if (!fs.existsSync(bashExe)) {
            vscode.window.showWarningMessage(`Gjs Maven: Cygwin bash not found at "${bashExe}". Check gjsMaven.cygwinPath.`);
            return;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return;
        }
        const vscodeDir = path.join(folders[0].uri.fsPath, '.vscode');
        const settingsFile = path.join(vscodeDir, 'settings.json');
        // Read existing settings.json or start fresh
        let settings = {};
        if (fs.existsSync(settingsFile)) {
            try {
                settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            }
            catch {
                vscode.window.showWarningMessage('Gjs Maven: Could not parse .vscode/settings.json');
                return;
            }
        }
        // Check if already registered
        const profiles = settings['terminal.integrated.profiles.windows'] ?? {};
        if (profiles['Cygwin']) {
            return;
        }
        // Add Cygwin profile
        profiles['Cygwin'] = {
            path: bashExe.replace(/\\/g, '\\\\'),
            args: ['-i /Cygwin-Terminal.ico -'],
            env: {
                CHERE_INVOKING: '1',
                CYGWIN: 'nodosfilewarning'
            }
        };
        settings['terminal.integrated.profiles.windows'] = profiles;
        // Write back
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 4), 'utf8');
        vscode.window.showInformationMessage('Gjs Maven: Cygwin terminal profile added to .vscode/settings.json. Select it from the terminal dropdown.');
    }
}
exports.CygwinTerminalProvider = CygwinTerminalProvider;
//# sourceMappingURL=CygwinTerminalProvider.js.map