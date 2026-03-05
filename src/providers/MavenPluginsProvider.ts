import * as vscode from 'vscode';
import * as fs from 'fs';

// ── Plugins Provider ──────────────────────────────────────────────────────────

export class MavenPluginsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void { this._onDidChangeTreeData.fire(); }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }

    async getChildren(): Promise<vscode.TreeItem[]> {
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 10);
        if (poms.length === 0) {
            return [makeInfoItem('No pom.xml found in workspace')];
        }
        const pom = poms[0]; // Show first project's plugins
        try {
            const text = fs.readFileSync(pom.fsPath, 'utf8');
            const plugins: vscode.TreeItem[] = [];
            const re = /<plugin>([\s\S]*?)<\/plugin>/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const block = m[1];
                const g = (block.match(/<groupId>([^<]+)/) || [])[1] || 'org.apache.maven.plugins';
                const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
                const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
                const item = new vscode.TreeItem(`${a}`, vscode.TreeItemCollapsibleState.None);
                item.description = `${g}:${v}`;
                item.iconPath = new vscode.ThemeIcon('extensions');
                item.tooltip = `${g}:${a}:${v}`;
                plugins.push(item);
            }
            return plugins.length > 0 ? plugins : [makeInfoItem('No plugins configured')];
        } catch {
            return [makeInfoItem('Could not read pom.xml')];
        }
    }
}

// ── Dependencies Provider ─────────────────────────────────────────────────────

export class MavenDependenciesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void { this._onDidChangeTreeData.fire(); }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }

    async getChildren(): Promise<vscode.TreeItem[]> {
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 10);
        if (poms.length === 0) {
            return [makeInfoItem('No pom.xml found')];
        }
        const pom = poms[0];
        try {
            const text = fs.readFileSync(pom.fsPath, 'utf8');
            const deps: vscode.TreeItem[] = [];
            const re = /<dependency>([\s\S]*?)<\/dependency>/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const block = m[1];
                const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
                const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
                const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
                const s = (block.match(/<scope>([^<]+)/) || [])[1] || 'compile';
                const item = new vscode.TreeItem(a, vscode.TreeItemCollapsibleState.None);
                item.description = `${v} [${s}]`;
                item.tooltip = `${g}:${a}:${v}`;
                item.iconPath = this.scopeIcon(s);
                deps.push(item);
            }
            return deps.length > 0 ? deps : [makeInfoItem('No dependencies declared')];
        } catch {
            return [makeInfoItem('Could not read pom.xml')];
        }
    }

    private scopeIcon(scope: string): vscode.ThemeIcon {
        const icons: Record<string, string> = {
            compile:  'library',
            provided: 'server',
            runtime:  'run',
            test:     'beaker',
            system:   'warning',
            import:   'file-symlink-file',
        };
        return new vscode.ThemeIcon(icons[scope] ?? 'library');
    }
}

function makeInfoItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
