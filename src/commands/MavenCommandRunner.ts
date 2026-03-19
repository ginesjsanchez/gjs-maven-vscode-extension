import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MavenStatusBar } from '../ui/MavenStatusBar';

export class MavenCommandRunner {
    private terminal: vscode.Terminal | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private profileManager?: import('./MavenProfileManager').MavenProfileManager,
		private optionsManager?: import('./MavenOptionsManager').MavenOptionsManager
    ) {}

    async run(goals: string, projectDir: string, statusBar?: MavenStatusBar): Promise<void> {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get<string>('settingsFile', '');
        const useExisting = config.get<boolean>('terminal.useExistingTerminal', true);

        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
		const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
        const command = `${mvn}${settingsArg}${profileArg}${optionsArg} ${goals}`;

        statusBar?.setRunning(goals);

        const terminal = this.getOrCreateTerminal(useExisting, projectDir);
        terminal.show(true);
        terminal.sendText(command);

        statusBar?.setReady();
    }

	async showEffectivePom(projectDir: string): Promise<void> {
		const config = vscode.workspace.getConfiguration('gjsMaven');
		const mvn = this.resolveMavenExecutable(projectDir, config);
		const settingsFile = config.get<string>('settingsFile', '');
		const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
		const profileArg = this.profileManager?.buildProfileArg() ?? '';
		const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
		
		const targetDir = path.join(projectDir, 'target');
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const outputFile = path.join(targetDir, 'effective-pom.xml');
		const command = `${mvn}${settingsArg}${profileArg}${optionsArg} help:effective-pom -Doutput="${outputFile}"`;

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

    async runToOutput(goals: string, projectDir: string, statusBar?: MavenStatusBar): Promise<void> {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn = this.resolveMavenExecutable(projectDir, config);
        const settingsFile = config.get<string>('settingsFile', '');
        const useExisting = config.get<boolean>('terminal.useExistingTerminal', true);

        const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
        const profileArg = this.profileManager?.buildProfileArg() ?? '';
		const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';
		
		const targetDir = path.join(projectDir, 'target');
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const outputFile = path.join(targetDir, 'output.txt');
		const command = `${mvn}${settingsArg}${profileArg}${optionsArg} ${goals} -Doutput="${outputFile}"`;

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

	async runToString(goals: string, projectDir: string): Promise<string | undefined> {
		const config = vscode.workspace.getConfiguration('gjsMaven');
		const mvn = this.resolveMavenExecutable(projectDir, config);
		const settingsFile = config.get<string>('settingsFile', '');
		const useExisting = config.get<boolean>('terminal.useExistingTerminal', true);
		const settingsArg = settingsFile ? ` -s "${settingsFile}"` : '';
		const profileArg = this.profileManager?.buildProfileArg() ?? '';
		const optionsArg = this.optionsManager?.buildOptionsArg() ?? '';

		const targetDir = path.join(projectDir, 'target');
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}
		const outputFile = path.join(targetDir, 'output.txt');
		// Distinto nombre para no colisionar con runToOutput
		const command = `${mvn}${settingsArg}${profileArg}${optionsArg} ${goals} > "${outputFile}"`;

		const terminal = this.getOrCreateTerminal(useExisting, projectDir);
		terminal.show(true);
		terminal.sendText(command);

		return new Promise<string | undefined>((resolve) => {
			const watcher = fs.watch(targetDir, (_event, filename) => {
				if (filename === 'output.txt' ) {
					watcher.close();
					setTimeout(() => {
						if (fs.existsSync(outputFile)) {
							const text = fs.readFileSync(outputFile, 'utf8');
							resolve(text.trim());
						}
					}, 5000);
				}
			});
			setTimeout(() => { watcher.close(); resolve(undefined); }, 30000);
		});
	}

    private resolveMavenExecutable(cwd: string, config: vscode.WorkspaceConfiguration): string {
        const configured = config.get<string>('mavenExecutable', 'mvn');
        if (configured !== 'mvn') { return configured; }

        const wrapperWin  = path.join(cwd, 'mvnw.cmd');
        const wrapperUnix = path.join(cwd, 'mvnw');
        if (process.platform === 'win32' && fs.existsSync(wrapperWin)) {
            return 'mvnw.cmd';
        }
        if (process.platform !== 'win32' && fs.existsSync(wrapperUnix)) {
            return './mvnw';
        }
        return 'mvn';
    }

	private getOrCreateTerminal(reuse: boolean, cwd: string): vscode.Terminal {
		if (reuse && this.terminal && this.isTerminalAlive(this.terminal)) {
			this.terminal.sendText(`cd "${cwd}"`);
			return this.terminal;
		}

		const config = vscode.workspace.getConfiguration('gjsMaven');
		const profileName = config.get<string>('terminalProfile', '').trim();

		if (profileName) {
			const profiles = vscode.workspace
				.getConfiguration('terminal.integrated')
				.get<Record<string, any>>('profiles.windows', {});
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
		if ( !this.terminal ) {
			this.terminal = vscode.window.createTerminal({
				name: 'Maven',
				cwd,
				iconPath: new vscode.ThemeIcon('package')
			});
		}
		return this.terminal;
	}

    private isTerminalAlive(terminal: vscode.Terminal): boolean {
        return vscode.window.terminals.includes(terminal);
    }
}
