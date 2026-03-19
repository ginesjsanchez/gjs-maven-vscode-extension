import * as vscode from 'vscode';
import * as fs from 'fs';

export class MavenParentProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(): vscode.TreeItem[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
            return [makeInfoItem('Open a pom.xml to see parent')];
        }

        let text: string;
        try {
            text = fs.readFileSync(editor.document.uri.fsPath, 'utf8');
        } catch {
            return [makeInfoItem('Could not read pom.xml')];
        }

        const parentMatch = text.match(/<parent>([\s\S]*?)<\/parent>/);
        if (!parentMatch) {
            return [makeInfoItem('No parent POM declared')];
        }

        const block = parentMatch[1];
        const groupId    = (block.match(/<groupId>([^<]+)/)    || [])[1] ?? '';
        const artifactId = (block.match(/<artifactId>([^<]+)/) || [])[1] ?? '';
        const version    = (block.match(/<version>([^<]+)/)    || [])[1] ?? '';
        const relative   = (block.match(/<relativePath>([^<]+)/) || [])[1] ?? '';

        const items: vscode.TreeItem[] = [];

        items.push(makeCoordItem('groupId',     groupId,    'symbol-namespace'));
        items.push(makeCoordItem('artifactId',  artifactId, 'symbol-class'));
        items.push(makeCoordItem('version',     version,    'tag'));
        if (relative) {
            items.push(makeCoordItem('relativePath', relative, 'file-symlink-file'));
        }

        return items;
    }
}

function makeCoordItem(label: string, value: string, icon: string): vscode.TreeItem {
    const item = new vscode.TreeItem(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(icon);
    item.tooltip = value;
    return item;
}

function makeInfoItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
