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
exports.MavenArchetypeRunner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
class MavenArchetypeRunner {
    getWorkspaceRoot() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return undefined;
        }
        return folders[0].uri.fsPath;
    }
    resolveMaven(config) {
        const configured = config.get('mavenExecutable', 'mvn');
        if (configured !== 'mvn') {
            return configured;
        }
        const root = this.getWorkspaceRoot();
        if (root) {
            const wrapperWin = path.join(root, 'mvnw.cmd');
            const wrapperUnix = path.join(root, 'mvnw');
            if (process.platform === 'win32' && fs.existsSync(wrapperWin)) {
                return 'mvnw.cmd';
            }
            if (process.platform !== 'win32' && fs.existsSync(wrapperUnix)) {
                return './mvnw';
            }
        }
        return 'mvn';
    }
    /**
     * Runs archetype:crawl via child_process and returns a Promise.
     * Shows a progress notification while running.
     */
    async crawlSync() {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return;
        }
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMaven(config);
        const settingsFile = config.get('settingsFile', '').trim();
        const settingsArg = settingsFile ? ['-s', settingsFile] : [];
        const args = [...settingsArg, 'archetype:crawl', '-B'];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Maven: Running archetype:crawl...',
            cancellable: false
        }, () => new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(mvn, args, { cwd: root, shell: true });
            proc.on('close', code => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`archetype:crawl exited with code ${code}`));
                }
            });
            proc.on('error', reject);
        })).then(() => vscode.window.showInformationMessage('Maven archetype:crawl completed.'), (err) => vscode.window.showErrorMessage(`archetype:crawl failed: ${err.message}`));
    }
    getOrCreateTerminal(cwd) {
        if (this.terminal && vscode.window.terminals.includes(this.terminal)) {
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
                    name: 'Maven Archetype',
                    cwd,
                    iconPath: new vscode.ThemeIcon('layers'),
                    shellPath: profile.path,
                    shellArgs: profile.args,
                    env: profile.env
                });
                return this.terminal;
            }
        }
        this.terminal = vscode.window.createTerminal({
            name: 'Maven Archetype',
            cwd,
            iconPath: new vscode.ThemeIcon('layers')
        });
        return this.terminal;
    }
    /**
     * mvn archetype:crawl -B
     * Crawls the local repository and generates an archetype catalog.
     */
    async crawl() {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return;
        }
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMaven(config);
        const settingsFile = config.get('settingsFile', '').trim();
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const command = `${mvn}${settingsArg} archetype:crawl -B`;
        const terminal = this.getOrCreateTerminal(root);
        terminal.show(true);
        terminal.sendText(`cd "${root}"`);
        terminal.sendText(command);
    }
    /**
     * mvn archetype:generate with groupId, artifactId, version.
     * Runs interactively so the user can fill in project details in the terminal.
     */
    async generate(archetypeGroupId, archetypeArtifactId, archetypeVersion) {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return;
        }
        if (!archetypeGroupId) {
            archetypeGroupId = await vscode.window.showInputBox({
                prompt: 'Archetype groupId',
                placeHolder: 'e.g. org.apache.maven.archetypes',
                ignoreFocusOut: true
            });
            if (!archetypeGroupId) {
                return;
            }
        }
        if (!archetypeArtifactId) {
            archetypeArtifactId = await vscode.window.showInputBox({
                prompt: 'Archetype artifactId',
                placeHolder: 'e.g. maven-archetype-quickstart',
                ignoreFocusOut: true
            });
            if (!archetypeArtifactId) {
                return;
            }
        }
        if (!archetypeVersion) {
            archetypeVersion = await vscode.window.showInputBox({
                prompt: 'Archetype version',
                placeHolder: 'e.g. 1.4',
                ignoreFocusOut: true
            });
            if (!archetypeVersion) {
                return;
            }
        }
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMaven(config);
        const settingsFile = config.get('settingsFile', '').trim();
        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const command = [
            `${mvn}${settingsArg} archetype:generate`,
            `-DarchetypeGroupId=${archetypeGroupId}`,
            `-DarchetypeArtifactId=${archetypeArtifactId}`,
            `-DarchetypeVersion=${archetypeVersion}`
        ].join(' ');
        const terminal = this.getOrCreateTerminal(root);
        terminal.show(true);
        terminal.sendText(`cd "${root}"`);
        terminal.sendText(command);
    }
}
exports.MavenArchetypeRunner = MavenArchetypeRunner;
//# sourceMappingURL=MavenArchetypeRunner.js.map