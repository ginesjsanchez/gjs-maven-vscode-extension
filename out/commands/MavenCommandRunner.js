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
const child_process_1 = require("child_process");
class MavenCommandRunner {
    constructor(context, profileManager, optionsManager) {
        this.context = context;
        this.profileManager = profileManager;
        this.optionsManager = optionsManager;
    }
    /**
     * -f con el pom del proyecto, para no depender del directorio del shell.
     *
     * El terminal se comparte entre invocaciones y quien lo sitúa es un `cd`
     * enviado con sendText, que escribe en el pty: si el shell está ocupado o
     * todavía arrancando puede perder los primeros caracteres. Visto en vivo un
     * `cd "..."` convertido en `d "..."` -> command not found -> el shell se
     * queda donde estaba y el goal siguiente se ejecuta en el módulo anterior,
     * sin el menor aviso.
     *
     * Con -f el comando es autosuficiente. El `cd` se mantiene para que el
     * prompt acompañe, pero ya no manda: si se pierde un carácter, ahora se
     * rompe el comando a la vista en vez de compilar en otro sitio.
     */
    fileArg(projectDir) {
        const pom = path.join(projectDir, 'pom.xml');
        return fs.existsSync(pom) ? ` -f "${pom}"` : '';
    }
    async run(goals, projectDir, statusBar) {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get('settingsFile', '');
        const useExisting = config.get('terminal.useExistingTerminal', true);
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
        const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
        const command = `${mvn}${settingsArg}${profileArg}${optionsArg}${this.fileArg(projectDir)} ${goals}`;
        statusBar?.setRunning(goals);
        const terminal = this.getOrCreateTerminal(useExisting, projectDir);
        terminal.show(true);
        terminal.sendText(command);
        statusBar?.setReady();
    }
    async runAndWait(goals, projectDir, channel) {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('gjsMaven');
            const mvn = this.resolveMavenExecutable(projectDir, config);
            const settingsFile = config.get('settingsFile', '');
            const useExisting = config.get('terminal.useExistingTerminal', true);
            const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
            const profileArg = this.profileManager?.buildProfileArg() ?? '';
            const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
            const command = `${mvn}${settingsArg}${profileArg}${optionsArg}${this.fileArg(projectDir)} ${goals}`;
            const proc = (0, child_process_1.exec)(command, { cwd: projectDir });
            proc.stdout?.on('data', (data) => channel.appendLine(data.toString()));
            proc.stderr?.on('data', (data) => channel.appendLine(data.toString()));
            proc.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`Maven salió con código ${code}`));
            });
            proc.on('error', reject);
        });
    }
    async showEffectivePom(projectDir) {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get('settingsFile', '');
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
        const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
        const targetDir = path.join(projectDir, 'target');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const outputFile = path.join(targetDir, 'effective-pom.xml');
        const command = `${mvn}${settingsArg}${profileArg}${optionsArg}${this.fileArg(projectDir)} help:effective-pom -Doutput="${outputFile}"`;
        const terminal = this.getOrCreateTerminal(false, projectDir);
        terminal.show(true);
        terminal.sendText(command);
        // Watch for the file to appear and open it immediately
        const watcher = fs.watch(targetDir, async (event, filename) => {
            if (filename === 'effective-pom.xml' && fs.existsSync(outputFile)) {
                watcher.close();
                const doc = await vscode.workspace.openTextDocument(outputFile);
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        });
        // Safety timeout: close watcher after 30s if Maven never finishes
        setTimeout(() => watcher.close(), 30000);
    }
    async runToOutput(goals, projectDir, statusBar) {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get('settingsFile', '');
        const useExisting = config.get('terminal.useExistingTerminal', true);
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
        const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
        const targetDir = path.join(projectDir, 'target');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const outputFile = path.join(targetDir, 'output.txt');
        const command = `${mvn}${settingsArg}${profileArg}${optionsArg}${this.fileArg(projectDir)} ${goals} -Doutput="${outputFile}"`;
        statusBar?.setRunning(goals);
        const terminal = this.getOrCreateTerminal(useExisting, projectDir);
        terminal.show(true);
        terminal.sendText(command);
        statusBar?.setReady();
        // Watch for the file to appear and open it immediately
        const watcher = fs.watch(targetDir, async (event, filename) => {
            if (filename === 'output.txt' && fs.existsSync(outputFile)) {
                watcher.close();
                const doc = await vscode.workspace.openTextDocument(outputFile);
                //const text = fs.readFileSync(outputFile, 'utf8');
                //const doc = await vscode.workspace.openTextDocument({
                //	content: text,
                //	language: 'plaintext'
                //});
                await vscode.window.showTextDocument(doc, {
                    preview: true,
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false
                });
                // Marcar el documento como readonly
                //await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
                //await vscode.window.showInformationMessage(doc.getText());
            }
        });
        // Safety timeout: close watcher after 30s if Maven never finishes
        setTimeout(() => watcher.close(), 30000);
    }
    async runToString(goals, projectDir) {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get('settingsFile', '');
        const useExisting = config.get('terminal.useExistingTerminal', true);
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
        const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
        const targetDir = path.join(projectDir, 'target');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const outputFile = path.join(targetDir, 'output.txt');
        // Distinto nombre para no colisionar con runToOutput
        const command = `${mvn}${settingsArg}${profileArg}${optionsArg}${this.fileArg(projectDir)} ${goals} > "${outputFile}"`;
        const terminal = this.getOrCreateTerminal(useExisting, projectDir);
        terminal.show(true);
        terminal.sendText(command);
        return new Promise((resolve) => {
            const watcher = fs.watch(targetDir, (_event, filename) => {
                if (filename === 'output.txt') {
                    watcher.close();
                    setTimeout(() => {
                        if (fs.existsSync(outputFile)) {
                            const waitForStable = (prevSize) => {
                                const currentSize = fs.statSync(outputFile).size;
                                if (currentSize === prevSize && currentSize > 0) {
                                    // Tamaño estable, ya terminó de escribir
                                    const text = fs.readFileSync(outputFile, 'utf8')
                                        ?.replace(/^\uFEFF/, '') // quita BOM
                                        ?.replace(/[^\x20-\x7E]/g, '') // quita caracteres no ASCII
                                        ?.trim();
                                    resolve(text);
                                }
                                else {
                                    // Sigue cambiando, esperar otro poco
                                    setTimeout(() => waitForStable(currentSize), 200);
                                }
                            };
                            waitForStable(-1);
                        }
                    }, 500); // pequeño delay inicial para que el fichero aparezca
                }
            });
            setTimeout(() => { watcher.close(); resolve(undefined); }, 30000);
        });
    }
    /**
     * Como runToString, pero sin terminal ni fichero intermedio: captura stdout
     * directamente. Pensado para consultas de fondo (no interactivas), donde
     * abrir un terminal y escribir en target/ sería una molestia.
     */
    async runToStringSilent(goals, projectDir, timeoutMs = 60000) {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get('settingsFile', '');
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
        const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
        const command = `${mvn}${settingsArg}${profileArg}${optionsArg}${this.fileArg(projectDir)} ${goals}`;
        return new Promise((resolve) => {
            (0, child_process_1.exec)(command, { cwd: projectDir, timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
                if (err) {
                    resolve(undefined);
                    return;
                }
                const text = stdout?.split(String.fromCharCode(0xFEFF)).join('').trim();
                resolve(text ? text : undefined);
            });
        });
    }
    resolveMavenExecutable(cwd, config) {
        const configured = config.get('mavenExecutable', 'mvn');
        if (configured !== 'mvn') {
            return configured;
        }
        const wrapperWin = path.join(cwd, 'mvnw.cmd');
        const wrapperUnix = path.join(cwd, 'mvnw');
        if (process.platform === 'win32' && fs.existsSync(wrapperWin)) {
            return 'mvnw.cmd';
        }
        if (process.platform !== 'win32' && fs.existsSync(wrapperUnix)) {
            return './mvnw';
        }
        return 'mvn';
    }
    getOrCreateTerminal(reuse, cwd) {
        if (reuse && this.terminal && this.isTerminalAlive(this.terminal)) {
            this.terminal.sendText(`cd "${cwd}"`);
            return this.terminal;
        }
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const profileName = config.get('terminalProfile', '').trim();
        if (profileName) {
            const profiles = vscode.workspace
                .getConfiguration('terminal.integrated')
                .get('profiles.windows', {});
            if (profiles[profileName]) {
                this.terminal = vscode.window.createTerminal({
                    name: 'Maven',
                    cwd,
                    iconPath: new vscode.ThemeIcon('package'),
                    shellPath: profiles[profileName]?.['path'],
                    shellArgs: profiles[profileName]?.['args'],
                    env: profiles[profileName]?.['env']
                });
            }
        }
        if (!this.terminal) {
            this.terminal = vscode.window.createTerminal({
                name: 'Maven',
                cwd,
                iconPath: new vscode.ThemeIcon('package')
            });
        }
        return this.terminal;
    }
    isTerminalAlive(terminal) {
        return vscode.window.terminals.includes(terminal);
    }
}
exports.MavenCommandRunner = MavenCommandRunner;
//# sourceMappingURL=MavenCommandRunner.js.map