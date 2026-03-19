import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CygwinTerminalProvider {

    activate(context: vscode.ExtensionContext): void {
        this.registerProfile();

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('gjsMaven.cygwinPath')) {
                    this.registerProfile();
                }
            })
        );
    }


    private registerProfile(): void {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const cygwinPath = config.get<string>('cygwinPath', '').trim();
        if (!cygwinPath) { return; }

        const bashExe = path.join(cygwinPath, 'bin', 'mintty.exe');
        if (!fs.existsSync(bashExe)) {
            vscode.window.showWarningMessage(
                `Gjs Maven: Cygwin bash not found at "${bashExe}". Check gjsMaven.cygwinPath.`
            );
            return;
        }

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) { return; }

        const vscodeDir = path.join(folders[0].uri.fsPath, '.vscode');
        const settingsFile = path.join(vscodeDir, 'settings.json');

        // Read existing settings.json or start fresh
        let settings: Record<string, unknown> = {};
        if (fs.existsSync(settingsFile)) {
            try {
                settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            } catch {
                vscode.window.showWarningMessage('Gjs Maven: Could not parse .vscode/settings.json');
                return;
            }
        }

        // Check if already registered
        const profiles = (settings['terminal.integrated.profiles.windows'] as Record<string, unknown>) ?? {};
        if (profiles['Cygwin']) { return; }

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

        vscode.window.showInformationMessage(
            'Gjs Maven: Cygwin terminal profile added to .vscode/settings.json. Select it from the terminal dropdown.'
        );
    }
}
