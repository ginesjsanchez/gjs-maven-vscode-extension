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
exports.MavenCommandRunner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class MavenCommandRunner {
    constructor(context) {
        this.context = context;
    }
    async run(goals, statusBar) {
        const workspaceFolder = await this.resolveWorkspaceFolder();
        if (!workspaceFolder) {
            return;
        }
        const config = vscode.workspace.getConfiguration('mavenPolyglot');
        const mvn = this.resolveMavenExecutable(workspaceFolder, config);
        const javaHome = config.get('javaHome', '');
        const useExisting = config.get('terminal.useExistingTerminal', true);
        const envPrefix = javaHome ? `JAVA_HOME="${javaHome}" ` : '';
        const command = `${envPrefix}${mvn} ${goals}`;
        statusBar?.setRunning(goals);
        const terminal = this.getOrCreateTerminal(useExisting, workspaceFolder);
        terminal.show(true);
        terminal.sendText(`cd "${workspaceFolder}" && ${command}`);
        statusBar?.setReady();
    }
    async showEffectivePom() {
        const workspaceFolder = await this.resolveWorkspaceFolder();
        if (!workspaceFolder) {
            return;
        }
        const config = vscode.workspace.getConfiguration('mavenPolyglot');
        const mvn = this.resolveMavenExecutable(workspaceFolder, config);
        const outputFile = path.join(workspaceFolder, 'effective-pom.xml');
        const terminal = this.getOrCreateTerminal(false, workspaceFolder);
        terminal.show(true);
        terminal.sendText(`cd "${workspaceFolder}" && ${mvn} help:effective-pom -Doutput="${outputFile}" && echo "Effective POM saved to effective-pom.xml"`);
        // Open the file after a short delay
        setTimeout(async () => {
            if (fs.existsSync(outputFile)) {
                const doc = await vscode.workspace.openTextDocument(outputFile);
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        }, 3000);
    }
    resolveMavenExecutable(cwd, config) {
        const configured = config.get('mavenExecutable', 'mvn');
        if (configured !== 'mvn') {
            return configured;
        }
        // Prefer wrapper if available
        const wrapperWin = path.join(cwd, 'mvnw.cmd');
        const wrapperUnix = path.join(cwd, 'mvnw');
        if (process.platform === 'win32' && fs.existsSync(wrapperWin)) {
            return '.\\mvnw.cmd';
        }
        if (process.platform !== 'win32' && fs.existsSync(wrapperUnix)) {
            return './mvnw';
        }
        return 'mvn';
    }
    getOrCreateTerminal(reuse, cwd) {
        if (reuse && this.terminal && this.isTerminalAlive(this.terminal)) {
            return this.terminal;
        }
        this.terminal = vscode.window.createTerminal({
            name: 'Maven',
            cwd,
            iconPath: new vscode.ThemeIcon('package')
        });
        return this.terminal;
    }
    isTerminalAlive(terminal) {
        return vscode.window.terminals.includes(terminal);
    }
    async resolveWorkspaceFolder() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return undefined;
        }
        if (folders.length === 1) {
            return folders[0].uri.fsPath;
        }
        // Multi-root: pick folder with a pom.xml, or ask
        const withPom = folders.filter(f => fs.existsSync(path.join(f.uri.fsPath, 'pom.xml')));
        if (withPom.length === 1) {
            return withPom[0].uri.fsPath;
        }
        const pick = await vscode.window.showQuickPick((withPom.length > 0 ? withPom : folders).map(f => ({
            label: f.name,
            description: f.uri.fsPath,
            folder: f
        })), { placeHolder: 'Select Maven project folder' });
        return pick?.folder.uri.fsPath;
    }
}
exports.MavenCommandRunner = MavenCommandRunner;
//# sourceMappingURL=MavenCommandRunner.js.map