import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CygwinScriptRunner {
    private terminal: vscode.Terminal | undefined;

    run(uri: vscode.Uri): void {
        const scriptPath = uri.fsPath;
        const dir        = path.dirname(scriptPath);
        const fileName   = path.basename(scriptPath);

        const terminal = this.getOrCreateTerminal(dir);
        terminal.show(true);
        // Convert Windows path to Unix-style for bash
        const unixPath = './' + fileName.replace(/\\/g, '/');
        terminal.sendText(`bash "${unixPath}"`);
    }

    private getOrCreateTerminal(cwd: string): vscode.Terminal {
        if (this.terminal && vscode.window.terminals.includes(this.terminal)) {
            this.terminal.sendText(`cd "${this.toCygwinPath(cwd)}"`);
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
        const cygwinBase = config.get<string>('cygwinPath', '').trim();
        const bashPath   = cygwinBase ? path.join(cygwinBase, 'bin', 'bash.exe') : '';

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

    private toCygwinPath(winPath: string): string {
        // Convert C:\foo\bar → /cygdrive/c/foo/bar
        return winPath.replace(/^([A-Za-z]):/, '/cygdrive/$1').replace(/\\/g, '/');
    }
}
