import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export class MavenArchetypeRunner {
    private terminal: vscode.Terminal | undefined;

    private getWorkspaceRoot(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return undefined;
        }
        return folders[0].uri.fsPath;
    }

    private resolveMaven(config: vscode.WorkspaceConfiguration): string {
        const configured = config.get<string>('mavenExecutable', 'mvn');
        if (configured !== 'mvn') { return configured; }
        const root = this.getWorkspaceRoot();
        if (root) {
            const wrapperWin  = path.join(root, 'mvnw.cmd');
            const wrapperUnix = path.join(root, 'mvnw');
            if (process.platform === 'win32' && fs.existsSync(wrapperWin)) { return 'mvnw.cmd'; }
            if (process.platform !== 'win32' && fs.existsSync(wrapperUnix)) { return './mvnw'; }
        }
        return 'mvn';
    }

    /**
     * Runs archetype:crawl via child_process and returns a Promise.
     * Shows a progress notification while running.
     */
    async crawlSync(): Promise<void> {
        const root = this.getWorkspaceRoot();
        if (!root) { return; }

        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn    = this.resolveMaven(config);
        const settingsFile = config.get<string>('settingsFile', '').trim();
        const settingsArg  = settingsFile ? ['-s', settingsFile] : [];

        const args = [...settingsArg, 'archetype:crawl', '-B'];

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Maven: Running archetype:crawl...',
                cancellable: false
            },
            () => new Promise<void>((resolve, reject) => {
                const proc = spawn(mvn, args, { cwd: root, shell: true });
                proc.on('close', code => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`archetype:crawl exited with code ${code}`));
                    }
                });
                proc.on('error', reject);
            })
        ).then(
            () => vscode.window.showInformationMessage('Maven archetype:crawl completed.'),
            (err) => vscode.window.showErrorMessage(`archetype:crawl failed: ${err.message}`)
        );
    }

    private getOrCreateTerminal(cwd: string): vscode.Terminal {
        if (this.terminal && vscode.window.terminals.includes(this.terminal)) {
            return this.terminal;
        }

        const config      = vscode.workspace.getConfiguration('gjsMaven');
        const profileName = config.get<string>('terminalProfile', '').trim();

        if (profileName) {
            const profiles = vscode.workspace
                .getConfiguration('terminal.integrated')
                .get<Record<string, any>>('profiles.windows', {});
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
    async crawl(): Promise<void> {
        const root = this.getWorkspaceRoot();
        if (!root) { return; }

        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn    = this.resolveMaven(config);
        const settingsFile = config.get<string>('settingsFile', '').trim();
        const settingsArg  = settingsFile ? ` -s "${settingsFile}"` : '';

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
	async generate(archetypeGroupId?: string, archetypeArtifactId?: string, archetypeVersion?: string): Promise<void> {
		const root = this.getWorkspaceRoot();
		if (!root) { return; }

		if (!archetypeGroupId) {
			archetypeGroupId = await vscode.window.showInputBox({
				prompt: 'Archetype groupId',
				placeHolder: 'e.g. org.apache.maven.archetypes',
				ignoreFocusOut: true
			});
			if (!archetypeGroupId) { return; }
		}

		if (!archetypeArtifactId) {
			archetypeArtifactId = await vscode.window.showInputBox({
				prompt: 'Archetype artifactId',
				placeHolder: 'e.g. maven-archetype-quickstart',
				ignoreFocusOut: true
			});
			if (!archetypeArtifactId) { return; }
		}

		if (!archetypeVersion) {
			archetypeVersion = await vscode.window.showInputBox({
				prompt: 'Archetype version',
				placeHolder: 'e.g. 1.4',
				ignoreFocusOut: true
			});
			if (!archetypeVersion) { return; }
		}
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const mvn    = this.resolveMaven(config);
        const settingsFile = config.get<string>('settingsFile', '').trim();
        const settingsArg  = settingsFile ? ` -s "${settingsFile}"` : '';

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
