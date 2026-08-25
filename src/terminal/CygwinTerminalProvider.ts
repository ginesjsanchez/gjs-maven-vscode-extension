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


    /**
     * Registra el perfil de terminal de Cygwin, si no lo hay ya.
     *
     * Va por la API de configuración, no por el fichero. settings.json es del
     * usuario y admite comentarios (jsonc): leerlo con JSON.parse fallaba en
     * cuanto había uno, y reescribirlo entero con JSON.stringify se los habría
     * llevado por delante junto con el formato. La API fusiona sobre lo que ya
     * hay y respeta el resto del fichero.
     */
    private registerProfile(): void {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        const cygwinPath = config.get<string>('cygwinPath', '').trim();
        if (!cygwinPath) { return; }

        const mintty = path.join(cygwinPath, 'bin', 'mintty.exe');
        const icon = path.join(cygwinPath, 'Cygwin-Terminal.ico');
        if (!fs.existsSync(mintty)) {
            vscode.window.showWarningMessage(
                `Gjs Maven: Cygwin terminal not found at "${mintty}". Check gjsMaven.cygwinPath.`
            );
            return;
        }

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) { return; }

        const terminal = vscode.workspace.getConfiguration('terminal.integrated');

        // Para decidir, el valor efectivo: si el perfil ya lo tiene puesto el
        // usuario en sus ajustes globales, no hay que duplicarlo en el workspace.
        const effective = terminal.get<Record<string, unknown>>('profiles.windows', {});
        if (effective['Cygwin']) { return; }

        // Para escribir, solo el ámbito propio: con el valor efectivo
        // acabaríamos copiando los perfiles del usuario dentro del workspace.
        const scoped = {
            ...(terminal.inspect<Record<string, unknown>>('profiles.windows')?.workspaceValue ?? {})
        };
        scoped['Cygwin'] = {
            path: mintty,
            args: ['-i', icon, '-'],
            env: {
                CHERE_INVOKING: '1',
                CYGWIN: 'nodosfilewarning'
            }
        };

        void terminal.update('profiles.windows', scoped, vscode.ConfigurationTarget.Workspace)
            .then(() => vscode.window.showInformationMessage(
                'Gjs Maven: Cygwin terminal profile added. Select it from the terminal dropdown.'
            ));
    }
}
