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
exports.CygwinScriptRunner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class CygwinScriptRunner {
    run(uri) {
        const scriptPath = uri.fsPath;
        const dir = path.dirname(scriptPath);
        const fileName = path.basename(scriptPath);
        const terminal = this.getOrCreateTerminal(dir);
        terminal.show(true);
        // Convert Windows path to Unix-style for bash
        const unixPath = './' + fileName.replace(/\\/g, '/');
        terminal.sendText(`bash "${unixPath}"`);
    }
    getOrCreateTerminal(cwd) {
        if (this.terminal && vscode.window.terminals.includes(this.terminal)) {
            this.terminal.sendText(`cd "${this.toCygwinPath(cwd)}"`);
            return this.terminal;
        }
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const profileName = config.get('terminalProfile', '').trim();
        if (profileName) {
            const profiles = vscode.workspace
                .getConfiguration('terminal.integrated')
                .get('profiles.windows', {});
            const profile = profiles[profileName];
            if (profile) {
                this.terminal = vscode.window.createTerminal({
                    name: 'Cygwin Script',
                    cwd,
                    iconPath: new vscode.ThemeIcon('terminal'),
                    shellPath: profile.path,
                    shellArgs: profile.args,
                    env: profile.env
                });
                return this.terminal;
            }
        }
        // Fallback: try to find bash.exe from gjsMaven.cygwinPath
        const cygwinBase = config.get('cygwinPath', '').trim();
        const bashPath = cygwinBase ? path.join(cygwinBase, 'bin', 'bash.exe') : '';
        if (bashPath && fs.existsSync(bashPath)) {
            this.terminal = vscode.window.createTerminal({
                name: 'Cygwin Script',
                cwd,
                iconPath: new vscode.ThemeIcon('terminal'),
                shellPath: bashPath,
                shellArgs: ['--login', '-i']
            });
            return this.terminal;
        }
        // Last resort: default terminal
        this.terminal = vscode.window.createTerminal({
            name: 'Cygwin Script',
            cwd,
            iconPath: new vscode.ThemeIcon('terminal')
        });
        return this.terminal;
    }
    toCygwinPath(winPath) {
        // Convert C:\foo\bar → /cygdrive/c/foo/bar
        return winPath.replace(/^([A-Za-z]):/, '/cygdrive/$1').replace(/\\/g, '/');
    }
}
exports.CygwinScriptRunner = CygwinScriptRunner;
//# sourceMappingURL=CygwinScriptRunner.js.map