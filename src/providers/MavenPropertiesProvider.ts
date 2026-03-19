import * as vscode from 'vscode';
import * as fs from 'fs';

function getActivePomPath(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('pom.xml')) {
        return editor.document.uri.fsPath;
    }
    return undefined;
}

function readActivePom(): string | undefined {
    const pomPath = getActivePomPath();
    if (!pomPath) { return undefined; }
    try { return fs.readFileSync(pomPath, 'utf8'); } catch { return undefined; }
}

/**
 * Extracts the content INSIDE a wrapper tag, excluding managed sections.
 * e.g. for dependencies: returns content of <dependencies> but NOT inside <dependencyManagement>
 */
function extractSection(text: string, tag: string, excludeWrapper?: string): string {
    if (excludeWrapper) {
        // Remove the excludeWrapper block first
        const exRe = new RegExp(`<${excludeWrapper}>[\\s\\S]*?<\\/${excludeWrapper}>`, 'g');
        text = text.replace(exRe, '');
    }
    const match = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
    return match ? match[0] : '';
}


//  Plugins Provider 

export class MavenPropertiesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(): vscode.TreeItem[] {
        const text = readActivePom();
        if (!text) { return [makeInfoItem('Open a pom.xml to see properties')]; }
        // Only plugins outside <pluginManagement>
        const section = extractSection(text, 'properties').replace("<properties>", "").replace("</properties>", "");
        return parseProperties(section) || [makeInfoItem('No properties configured')];
    }
}


//  Parsers 
function parseProperties(section: string): vscode.TreeItem[] | null {
    const items: vscode.TreeItem[] = [];
    const re = /<!--[\s\S]*?-->|<([a-zA-Z0-9._-]+)>([\s\S]*?)<\/\1>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(section)) !== null) {
		if (!m[1]) { continue; } // es un comentario, saltarif (!m[1]) { continue; } // es un comentario, saltar 
		const name = m[1];
        const value = m[2];
        const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None);
        item.description = value;
        item.tooltip = `${name}`;
        item.iconPath = new vscode.ThemeIcon('symbol-property');
        items.push(item);
    }
    return items.length > 0 ? items : null;
}


function makeInfoItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
