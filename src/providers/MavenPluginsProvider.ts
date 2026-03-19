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

/**
 * Extracts the content INSIDE a managed wrapper tag.
 * e.g. for managedDependencies: returns content of <dependencyManagement><dependencies>
 */
function extractManagedSection(text: string, wrapperTag: string, innerTag: string): string {
    const wrapperMatch = text.match(new RegExp(`<${wrapperTag}>([\\s\\S]*?)<\\/${wrapperTag}>`));
    if (!wrapperMatch) { return ''; }
    const innerMatch = wrapperMatch[1].match(new RegExp(`<${innerTag}>([\\s\\S]*?)<\\/${innerTag}>`));
    return innerMatch ? innerMatch[1] : '';
}

//  Plugins Provider 

export class MavenPluginsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(): vscode.TreeItem[] {
        const text = readActivePom();
        if (!text) { return [makeInfoItem('Open a pom.xml to see plugins')]; }
        // Only plugins outside <pluginManagement>
        const section = extractSection(text, 'plugins', 'pluginManagement');
        return parsePlugins(section) || [makeInfoItem('No plugins configured')];
    }
}

//  Managed Plugins Provider 

export class MavenManagedPluginsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(): vscode.TreeItem[] {
        const text = readActivePom();
        if (!text) { return [makeInfoItem('Open a pom.xml to see managed plugins')]; }
        const section = extractManagedSection(text, 'pluginManagement', 'plugins');
        return parsePlugins(section) || [makeInfoItem('No managed plugins configured')];
    }
}

//  Dependencies Provider 

export class MavenDependenciesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(): vscode.TreeItem[] {
        const text = readActivePom();
        if (!text) { return [makeInfoItem('Open a pom.xml to see dependencies')]; }
        // Only dependencies outside <dependencyManagement>
        const section = extractSection(text, 'dependencies', 'dependencyManagement');
        return parseDependencies(section) || [makeInfoItem('No dependencies declared')];
    }
}

//  Managed Dependencies Provider 

export class MavenManagedDependenciesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(): vscode.TreeItem[] {
        const text = readActivePom();
        if (!text) { return [makeInfoItem('Open a pom.xml to see managed dependencies')]; }
        const section = extractManagedSection(text, 'dependencyManagement', 'dependencies');
        return parseDependencies(section) || [makeInfoItem('No managed dependencies declared')];
    }
}

//  Parsers 

function parsePlugins(section: string): vscode.TreeItem[] | null {
    const items: vscode.TreeItem[] = [];
    const re = /<plugin>([\s\S]*?)<\/plugin>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(section)) !== null) {
        const block = m[1];
        const g = (block.match(/<groupId>([^<]+)/) || [])[1] || 'org.apache.maven.plugins';
        const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
        const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
        const item = new vscode.TreeItem(a, vscode.TreeItemCollapsibleState.None);
        item.description = v;
        item.tooltip = `${g}:${a}:${v}`;
        item.iconPath = new vscode.ThemeIcon('extensions');
        items.push(item);
    }
    return items.length > 0 ? items : null;
}

function parseDependencies(section: string): vscode.TreeItem[] | null {
    const items: vscode.TreeItem[] = [];
    const re = /<dependency>([\s\S]*?)<\/dependency>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(section)) !== null) {
        const block = m[1];
        const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
        const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '?';
        const v = (block.match(/<version>([^<]+)/) || [])[1] || '(managed)';
        const s = (block.match(/<scope>([^<]+)/) || [])[1] || 'compile';
        const item = new vscode.TreeItem(a, vscode.TreeItemCollapsibleState.None);
        item.description = `${v} [${s}]`;
        item.tooltip = `${g}:${a}:${v}`;
        item.iconPath = scopeIcon(s);
        items.push(item);
    }
    return items.length > 0 ? items : null;
}

function scopeIcon(scope: string): vscode.ThemeIcon {
    const icons: Record<string, string> = {
        compile: 'library', provided: 'server', runtime: 'run',
        test: 'beaker', system: 'warning', import: 'file-symlink-file',
    };
    return new vscode.ThemeIcon(icons[scope] ?? 'library');
}

function makeInfoItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
