import * as vscode from 'vscode';

export class MavenStatusBar implements vscode.Disposable {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.item.command = 'gjs-maven-vscode-extension.runCommand';
        this.item.hide();
    }

    setReady(): void {
        const config = vscode.workspace.getConfiguration('mavenPolyglot');
        if (!config.get<boolean>('showStatusBar', true)) {
            this.item.hide();
            return;
        }
        this.item.text = '$(package) Maven';
        this.item.tooltip = 'Click to run Maven goal';
        this.item.backgroundColor = undefined;
        this.item.show();
    }

    setRunning(goal: string): void {
        this.item.text = `$(loading~spin) mvn ${goal}`;
        this.item.tooltip = `Running: mvn ${goal}`;
        this.item.show();
    }

    setError(goal: string): void {
        this.item.text = `$(error) mvn ${goal} failed`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.item.show();
    }

    dispose(): void {
        this.item.dispose();
    }
}
