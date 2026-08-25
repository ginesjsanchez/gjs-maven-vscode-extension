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
        const settingsArg  = settingsFile ? ` -s "${settingsFile}"` : '';

        // En Windows 'mvn' es un .cmd y hace falta shell para lanzarlo. Pero con
        // shell:true, pasar además un array de argumentos está desaconsejado
        // (DEP0190): Node los concatena sin escapar. Se manda la línea entera,
        // ya entrecomillada aquí, que es lo único que el shell va a interpretar.
        //
        // -N no es opcional. El goal crawl declara <aggregator>false</aggregator>,
        // así que en un proyecto multimódulo Maven lo ejecuta UNA VEZ POR MÓDULO,
        // y cada pasada recorre el repositorio local entero. En un árbol de 120
        // módulos eso son 120 recorridos de varios minutos cada uno. Además
        // declara <requiresProject>false</requiresProject>: no mira el proyecto
        // para nada, solo el repositorio, así que una sola pasada es lo correcto.
        const command = `${mvn}${settingsArg} archetype:crawl -B -N`;

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Maven: Running archetype:crawl...',
                cancellable: true
            },
            (_progress, token) => new Promise<void>((resolve, reject) => {
                const proc = spawn(command, { cwd: root, shell: true });

                // Recorrer el repositorio lleva minutos; poder cortarlo importa
                token.onCancellationRequested(() => proc.kill());

                // Sin esto el fallo solo dice el código de salida, y hay que ir a
                // buscar a la consola por qué. archetype:crawl puede tardar
                // minutos recorriendo el repositorio local, así que conviene
                // dejar rastro de lo que pasó.
                let tail = '';
                const keep = (chunk: Buffer) => {
                    tail = (tail + chunk.toString()).slice(-4000);
                };
                proc.stdout?.on('data', keep);
                proc.stderr?.on('data', keep);

                proc.on('close', (code, signal) => {
                    if (code === 0) {
                        resolve();
                        return;
                    }
                    if (token.isCancellationRequested || signal) {
                        reject(new Error('cancelled'));
                        return;
                    }
                    MavenArchetypeRunner.report(command, tail);
                    reject(new Error(`archetype:crawl exited with code ${code}`));
                });
                proc.on('error', reject);
            })
        ).then(
            () => vscode.window.showInformationMessage('Maven archetype:crawl completed.'),
            (err) => {
                if (err.message === 'cancelled') { return; }
                vscode.window.showErrorMessage(
                    `archetype:crawl failed: ${err.message}`, 'Show output'
                ).then(choice => {
                    if (choice === 'Show output') { MavenArchetypeRunner.channel().show(true); }
                });
            }
        );
    }

    private static _channel: vscode.OutputChannel | undefined;
    private static channel(): vscode.OutputChannel {
        if (!MavenArchetypeRunner._channel) {
            MavenArchetypeRunner._channel = vscode.window.createOutputChannel('GJS Maven: Archetypes');
        }
        return MavenArchetypeRunner._channel;
    }

    /** Deja en un canal lo último que dijo Maven, para no adivinar por el código. */
    private static report(command: string, tail: string): void {
        const channel = MavenArchetypeRunner.channel();
        channel.appendLine(`$ ${command}`);
        channel.appendLine(tail.trim() || '(sin salida)');
        channel.appendLine('');
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

        // -N por lo mismo que en crawlSync: el goal no es agregador y sin esto
        // se ejecuta una vez por módulo del reactor.
        const command = `${mvn}${settingsArg} archetype:crawl -B -N`;

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

        // -N: archetype:generate tampoco es agregador. Sin él, lanzado desde la
        // raíz de un proyecto multimódulo se ejecutaría una vez por módulo, y
        // como es interactivo acabaría preguntando tantas veces como módulos hay.
        const command = [
            `${mvn}${settingsArg} archetype:generate -N`,
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
