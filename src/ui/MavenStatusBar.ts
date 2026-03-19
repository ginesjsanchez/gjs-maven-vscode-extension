import * as vscode from 'vscode';

export class MavenStatusBar implements vscode.Disposable {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.item.command = 'gjs-maven-vscode-extension.manageProfiles';
        this.item.hide();
    }

    setReady(profiles: string[] = []): void {
        const config = vscode.workspace.getConfiguration('gjsMaven');
        if (!config.get<boolean>('showStatusBar', true)) {
            this.item.hide();
            return;
        }
        const profilesText = profiles.length > 0 ? `${profiles.join(', ')}` : '<default>';
        const profileLabel = ` [${profilesText}]`;
        this.item.text = `$(package) Maven ${profileLabel}`;
        this.item.tooltip = `Maven Active profiles: ${profilesText}`
		this.item.color = undefined; 
        this.item.backgroundColor = undefined;
        this.item.show();
    }

    setRunning(goal: string, profiles: string[] = []): void {
        const profilesText = profiles.length > 0 ? `${profiles.join(', ')}` : '<default>';
        const profileLabel = ` [${profilesText}]`;
        this.item.text = `$(loading~spin) mvn ${goal}${profileLabel}`;
        this.item.tooltip = `Running: mvn ${goal}`;
		this.item.color = undefined; 
        this.item.backgroundColor = undefined;
        this.item.show();
    }

    setError(goal: string): void {
        this.item.text = `$(error) mvn ${goal} failed`;
		this.item.color = undefined; 
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.item.show();
    }

	setAggregator(artifactId: string, profiles: string[] = []): void {
        const profilesText = profiles.length > 0 ? `${profiles.join(', ')}` : '<default>';
        const profileLabel = ` [${profilesText}]`;
		this.item.text = `$(folder-library) Maven ${profileLabel}`;
        this.item.tooltip = `This is an aggregator POM. Maven Active profiles: ${profilesText}`
		this.item.color = 'yellow' 
        this.item.backgroundColor = undefined;
		this.item.show();
	}

	setParent(artifactId: string, profiles: string[] = []): void {
        const profilesText = profiles.length > 0 ? `${profiles.join(', ')}` : '<default>';
        const profileLabel = ` [${profilesText}]`;
		this.item.text = `$(type-hierarchy) Maven ${profileLabel}`;
        this.item.tooltip = `This is an aggregator POM. Maven Active profiles: ${profilesText}`
		this.item.color = 'green' 
        this.item.backgroundColor = undefined;
		this.item.show();
	}

	setArchetype(artifactId: string, profiles: string[] = []): void {
        const profilesText = profiles.length > 0 ? `${profiles.join(', ')}` : '<default>';
        const profileLabel = ` [${profilesText}]`;
		this.item.text = `$(symbol-structure) Maven ${profileLabel}`;
        this.item.tooltip = `This is an aggregator POM. Maven Active profiles: ${profilesText}`
		this.item.color = 'red' 
        this.item.backgroundColor = undefined;
		this.item.show();
	}
	
    dispose(): void {
        this.item.dispose();
    }
}
