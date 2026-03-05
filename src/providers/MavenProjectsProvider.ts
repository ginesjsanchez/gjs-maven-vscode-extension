import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class MavenProjectsProvider implements vscode.TreeDataProvider<MavenProjectItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<MavenProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void { this._onDidChangeTreeData.fire(); }

    async getChildren(element?: MavenProjectItem): Promise<MavenProjectItem[]> {
        if (!element) {
            // Root: find all pom.xml files
            const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 50);
            return poms.map(uri => new MavenProjectItem(uri));
        }
        // Children: show groupId, artifactId, version from pom
        return element.getDetails();
    }

    getTreeItem(element: MavenProjectItem): vscode.TreeItem { return element; }
}

export class MavenProjectItem extends vscode.TreeItem {
    constructor(public readonly pomUri: vscode.Uri) {
        const rel = vscode.workspace.asRelativePath(pomUri);
        const dir = path.dirname(rel);
        super(dir === '.' ? 'Root Project' : dir, vscode.TreeItemCollapsibleState.Collapsed);
        this.resourceUri = pomUri;
        this.contextValue = 'mavenProject';
        this.iconPath = new vscode.ThemeIcon('package');
        this.tooltip = pomUri.fsPath;
        this.command = {
            command: 'vscode.open',
            title: 'Open pom.xml',
            arguments: [pomUri]
        };

        // Parse name from pom
        try {
            const text = fs.readFileSync(pomUri.fsPath, 'utf8');
            const artifactId = (text.match(/<artifactId>([^<]+)<\/artifactId>/) || [])[1];
            const version = (text.match(/<version>([^<]+)<\/version>/) || [])[1];
            if (artifactId) {
                this.label = artifactId;
                this.description = version ?? '';
            }
        } catch { /* ignore */ }
    }

    async getDetails(): Promise<MavenProjectItem[]> {
        try {
            const text = fs.readFileSync(this.pomUri.fsPath, 'utf8');
            const items: DetailItem[] = [];

            const fields: [string, string][] = [
                ['groupId', 'symbol-namespace'],
                ['artifactId', 'symbol-class'],
                ['version', 'tag'],
                ['packaging', 'archive'],
            ];
            for (const [field, icon] of fields) {
                const val = (text.match(new RegExp(`<${field}>([^<]+)<\/${field}>`)) || [])[1];
                if (val) {
                    items.push(new DetailItem(`${field}: ${val}`, icon));
                }
            }
            return items as unknown as MavenProjectItem[];
        } catch {
            return [];
        }
    }
}

class DetailItem extends vscode.TreeItem {
    constructor(label: string, icon: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'mavenDetail';
    }
}
