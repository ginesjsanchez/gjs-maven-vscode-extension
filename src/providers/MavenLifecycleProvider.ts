import * as vscode from 'vscode';

const PHASES = [
    { phase: 'clean',          icon: 'trash',         description: 'Remove previous build output' },
    { phase: 'validate',       icon: 'check',         description: 'Validate project structure' },
    { phase: 'compile',        icon: 'symbol-class',  description: 'Compile source code' },
    { phase: 'test',           icon: 'beaker',        description: 'Run unit tests' },
    { phase: 'package',        icon: 'archive',       description: 'Package compiled code (jar/war)' },
    { phase: 'verify',         icon: 'verified',      description: 'Run integration tests' },
    { phase: 'install',        icon: 'desktop-download', description: 'Install to local repository' },
    { phase: 'deploy',         icon: 'cloud-upload',  description: 'Deploy to remote repository' },
    { phase: 'clean install',  icon: 'play',          description: 'Clean then install (most common)' },
    { phase: 'clean package',  icon: 'play',          description: 'Clean then package' },
    { phase: 'dependency:tree',icon: 'type-hierarchy', description: 'Show dependency tree' },
    { phase: 'site',           icon: 'globe',         description: 'Generate project site' },
];

export class MavenLifecycleProvider implements vscode.TreeDataProvider<LifecycleItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: LifecycleItem): vscode.TreeItem { return element; }

    getChildren(): LifecycleItem[] {
        return PHASES.map(p => new LifecycleItem(p.phase, p.icon, p.description));
    }
}

class LifecycleItem extends vscode.TreeItem {
    constructor(phase: string, icon: string, description: string) {
        super(phase, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.tooltip = description;
        this.description = description;
        this.contextValue = 'mavenGoal';
        this.command = {
            command: 'gjs-maven-vscode-extension.runCommand',
            title: `Run: ${phase}`,
            arguments: [phase]
        };
    }
}
