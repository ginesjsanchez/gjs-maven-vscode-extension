import * as vscode from 'vscode';
import { MavenStatusBar } from '../ui/MavenStatusBar';

export class MavenProfileManager {
    private static readonly KEY = 'gjsMaven.activeProfiles';

    constructor(
        private context: vscode.ExtensionContext,
        private statusBar: MavenStatusBar
    ) {}

    getActiveProfiles(): string[] {
        return this.context.workspaceState.get<string[]>(MavenProfileManager.KEY, []);
    }

    buildProfileArg(): string {
        const profiles = this.getActiveProfiles();
        return profiles.length > 0 ? ` -P ${profiles.join(',')}` : '';
    }

    // Called from command palette (no name: shows quick pick)
    // Called from webview (name provided directly)
    async addProfile(name?: string): Promise<void> {
        if (!name) {
            const input = await vscode.window.showInputBox({
                placeHolder: 'e.g. dev, local, prod',
                prompt: 'Enter Maven profile name to activate',
                validateInput: v => v.trim() === '' ? 'Profile name cannot be empty' : undefined
            });
            if (!input) { return; }
            name = input.trim();
        }

        const profiles = this.getActiveProfiles();
        if (profiles.includes(name)) {
            vscode.window.showInformationMessage(`Profile '${name}' is already active.`);
            return;
        }
        profiles.push(name);
        await this.save(profiles);
    }

    // Called from command palette (no name: shows quick pick)
    // Called from webview (name provided directly)
    async removeProfile(name?: string): Promise<void> {
        const profiles = this.getActiveProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No active profiles to remove.');
            return;
        }

        if (!name) {
            const pick = await vscode.window.showQuickPick(profiles, {
                placeHolder: 'Select profile to deactivate'
            });
            if (!pick) { return; }
            name = pick;
        }

        await this.save(profiles.filter(p => p !== name));
    }

    async clearProfiles(): Promise<void> {
        const profiles = this.getActiveProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No active profiles.');
            return;
        }
        await this.save([]);
        vscode.window.showInformationMessage('All Maven profiles cleared.');
    }

    private async save(profiles: string[]): Promise<void> {
        await this.context.workspaceState.update(MavenProfileManager.KEY, profiles);
        this.statusBar.setReady(profiles);
    }
}
