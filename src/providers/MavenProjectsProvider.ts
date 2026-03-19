import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface PomInfo {
    uri:        vscode.Uri;
    artifactId: string;
    groupId:    string;
    version:    string;
    packaging:  string;
    modules:    string[]; // module directory names declared in <modules>
}

function parsePom(uri: vscode.Uri): PomInfo {
    const text = fs.readFileSync(uri.fsPath, 'utf8');

    // Strip nested sections to avoid picking up child coords
    const stripped = text
        .replace(/<parent>[\s\S]*?<\/parent>/g, '')
        .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, '')
        .replace(/<plugins>[\s\S]*?<\/plugins>/g, '');

    const artifactId = (stripped.match(/<artifactId>([^<]+)/) || [])[1]?.trim() ?? path.basename(path.dirname(uri.fsPath));
    const groupId    = (stripped.match(/<groupId>([^<]+)/)    || [])[1]?.trim() ?? '';
    const version    = (stripped.match(/<version>([^<]+)/)    || [])[1]?.trim() ?? '';
    const packaging  = (stripped.match(/<packaging>([^<]+)/)  || [])[1]?.trim() ?? 'jar';

    const modules: string[] = [];
    const modulesMatch = text.match(/<modules>([\s\S]*?)<\/modules>/);
    if (modulesMatch) {
        const re = /<module>([^<]+)<\/module>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(modulesMatch[1])) !== null) {
            modules.push(m[1].trim());
        }
    }

    return { uri, artifactId, groupId, version, packaging, modules };
}

export class MavenProjectsProvider implements vscode.TreeDataProvider<MavenProjectItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<MavenProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private pomMap = new Map<string, PomInfo>(); // fsPath -> PomInfo
    private roots: PomInfo[] = [];

    refresh(): void {
        this.pomMap.clear();
        this.roots = [];
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MavenProjectItem): vscode.TreeItem { return element; }

    async getChildren(element?: MavenProjectItem): Promise<MavenProjectItem[]> {
        if (!element) {
            await this.buildTree();
           return this.roots.map(p => new MavenProjectItem(p, true));
        }

        if (element.type === 'project') {
            const pom = this.pomMap.get(element.pomInfo.uri.fsPath);
           if (!pom) { return []; }

            const items: MavenProjectItem[] = [];

            // Details
            items.push(new MavenProjectItem(pom, false, `groupId: ${pom.groupId}`,    'symbol-namespace'));
            items.push(new MavenProjectItem(pom, false, `version: ${pom.version}`,     'tag'));
            items.push(new MavenProjectItem(pom, false, `packaging: ${pom.packaging}`, 'archive'));

            // Child modules
            for (const mod of pom.modules) {
                const modPomPath = path.join(path.dirname(pom.uri.fsPath), mod, 'pom.xml');
                const childPom = this.pomMap.get(modPomPath);
                if (childPom) {
                    items.push(new MavenProjectItem(childPom, true));
                }
            }

            return items;
        }

        return [];
    }
	
    private async buildTree(): Promise<void> {
        const uris = await vscode.workspace.findFiles(
            '**/pom.xml',
            '{**/node_modules/**,**/target/**,**/archetype-resources/**}',
            50
        );

        for (const uri of uris) {
            try {
                const info = parsePom(uri);
                this.pomMap.set(uri.fsPath, info);
            } catch { /* skip unreadable */ }
        }

        // Determine roots: poms that are not a module of another pom
        const childPaths = new Set<string>();
        for (const pom of this.pomMap.values()) {
            for (const mod of pom.modules) {
                const childPath = path.join(path.dirname(pom.uri.fsPath), mod, 'pom.xml');
                childPaths.add(childPath);
            }
        }

        this.roots = [];
        for (const pom of this.pomMap.values()) {
            if (!childPaths.has(pom.uri.fsPath)) {
                this.roots.push(pom);
            }
        }

        // Sort roots by artifactId
        this.roots.sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    }
}

export class MavenProjectItem extends vscode.TreeItem {
    type: 'project' | 'detail';

	constructor(
		public readonly pomInfo: PomInfo,
		isProject: boolean,
		detailLabel?: string,
		detailIcon?: string
	) {
		super(
			isProject ? pomInfo.artifactId : (detailLabel ?? ''),
			vscode.TreeItemCollapsibleState.Collapsed
		);

		if (isProject) {
			this.type = 'project';
			this.description = pomInfo.version;
			this.tooltip = `${pomInfo.groupId}:${pomInfo.artifactId}:${pomInfo.version}`;
			this.iconPath = this.resolveIcon(pomInfo.packaging, pomInfo.modules.length > 0);
 			this.contextValue = 'mavenProject';
			this.command = {
				command: 'vscode.open',
				title: 'Open pom.xml',
				arguments: [pomInfo.uri]
			};
		} else {
			this.type = 'detail';
			this.collapsibleState = vscode.TreeItemCollapsibleState.None;
			this.iconPath = new vscode.ThemeIcon(detailIcon ?? 'info');
			this.contextValue = 'mavenDetail';
		}
	}

	private resolveIcon(packaging: string, hasModules: boolean): vscode.ThemeIcon {
		if (packaging === 'pom' && hasModules) {
			return new vscode.ThemeIcon('folder-library');
		} else if (packaging === 'pom') {
			return new vscode.ThemeIcon('type-hierarchy');
		} else if (packaging === 'maven-archetype') {
			return new vscode.ThemeIcon('symbol-structure');
		} else {
			return new vscode.ThemeIcon('package');
		}
	}
}
