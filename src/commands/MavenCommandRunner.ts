import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MavenStatusBar } from '../ui/MavenStatusBar';

export class MavenCommandRunner {
    private terminal: vscode.Terminal | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    async run(goals: string, statusBar?: MavenStatusBar): Promise<void> {
        const workspaceFolder = await this.resolveWorkspaceFolder();
        if (!workspaceFolder) { return; }

        const config = vscode.workspace.getConfiguration('mavenPolyglot');
        const mvn = this.resolveMavenExecutable(workspaceFolder, config);
        const javaHome = config.get<string>('javaHome', '');
        const useExisting = config.get<boolean>('terminal.useExistingTerminal', true);

        const envPrefix = javaHome ? `JAVA_HOME="${javaHome}" ` : '';
        const command = `${envPrefix}${mvn} ${goals}`;

        statusBar?.setRunning(goals);

        const terminal = this.getOrCreateTerminal(useExisting, workspaceFolder);
        terminal.show(true);
        terminal.sendText(`cd "${workspaceFolder}" && ${command}`);

        statusBar?.setReady();
    }

    async showEffectivePom(): Promise<void> {
        const workspaceFolder = await this.resolveWorkspaceFolder();
        if (!workspaceFolder) { return; }

        const config = vscode.workspace.getConfiguration('mavenPolyglot');
        const mvn = this.resolveMavenExecutable(workspaceFolder, config);
        const outputFile = path.join(workspaceFolder, 'effective-pom.xml');

        const terminal = this.getOrCreateTerminal(false, workspaceFolder);
        terminal.show(true);
        terminal.sendText(
            `cd "${workspaceFolder}" && ${mvn} help:effective-pom -Doutput="${outputFile}" && echo "Effective POM saved to effective-pom.xml"`
        );

        // Open the file after a short delay
        setTimeout(async () => {
            if (fs.existsSync(outputFile)) {
                const doc = await vscode.workspace.openTextDocument(outputFile);
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        }, 3000);
    }

    private resolveMavenExecutable(cwd: string, config: vscode.WorkspaceConfiguration): string {
        const configured = config.get<string>('mavenExecutable', 'mvn');
        if (configured !== 'mvn') { return configured; }

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

    private getOrCreateTerminal(reuse: boolean, cwd: string): vscode.Terminal {
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

    private isTerminalAlive(terminal: vscode.Terminal): boolean {
        return vscode.window.terminals.includes(terminal);
    }

    private async resolveWorkspaceFolder(): Promise<string | undefined> {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return undefined;
        }
        if (folders.length === 1) {
            return folders[0].uri.fsPath;
        }
        // Multi-root: pick folder with a pom.xml, or ask
        const withPom = folders.filter(f =>
            fs.existsSync(path.join(f.uri.fsPath, 'pom.xml'))
        );
        if (withPom.length === 1) { return withPom[0].uri.fsPath; }

        const pick = await vscode.window.showQuickPick(
            (withPom.length > 0 ? withPom : folders).map(f => ({
                label: f.name,
                description: f.uri.fsPath,
                folder: f
            })),
            { placeHolder: 'Select Maven project folder' }
        );
        return pick?.folder.uri.fsPath;
    }
}
