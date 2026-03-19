import * as vscode from 'vscode';

export class MavenOptionsManager {
    private static readonly KEY_OPTIONS = 'gjsMaven.additionalOptions';
    private static readonly KEY_DEBUG   = 'gjsMaven.debugMode';

    constructor(
        private context: vscode.ExtensionContext,
    ) {}

    getOptions(): string[] {
        return this.context.workspaceState.get<string[]>(MavenOptionsManager.KEY_OPTIONS, []);
    }

    isDebug(): boolean {
        return this.context.workspaceState.get<boolean>(MavenOptionsManager.KEY_DEBUG, false);
    }

    buildOptionsArg(): string {
        const opts = this.getOptions().map(o => {
            // Already has -D prefix → leave as is
            if (o.startsWith('-')) { return o; }
            return `-D${o}`;
        });
        if (this.isDebug()) { opts.push('-X'); }
        return opts.length > 0 ? ' ' + opts.join(' ') : '';
    }

    async addOption(name?: string): Promise<void> {
        if (!name) {
            const input = await vscode.window.showInputBox({
                placeHolder: 'e.g. skipTests  or  maven.test.skip=true',
                prompt: 'Enter option (word or key=value). -D will be added automatically.',
                validateInput: v => v.trim() === '' ? 'Option cannot be empty' : undefined
            });
            if (!input) { return; }
            name = input.trim();
        }
        const options = this.getOptions();
        if (options.includes(name)) {
            vscode.window.showInformationMessage(`Option '${name}' is already set.`);
            return;
        }
        options.push(name);
        await this.saveOptions(options);
    }

    async removeOption(name?: string): Promise<void> {
        const options = this.getOptions();
        if (options.length === 0) {
            vscode.window.showInformationMessage('No additional options set.');
            return;
        }
        if (!name) {
            const pick = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select option to remove'
            });
            if (!pick) { return; }
            name = pick;
        }
        await this.saveOptions(options.filter(o => o !== name));
    }

    async clearOptions(): Promise<void> {
        await this.saveOptions([]);
    }

    async setDebug(enabled: boolean): Promise<void> {
        await this.context.workspaceState.update(MavenOptionsManager.KEY_DEBUG, enabled);
    }

    private async saveOptions(options: string[]): Promise<void> {
        await this.context.workspaceState.update(MavenOptionsManager.KEY_OPTIONS, options);
    }
}
