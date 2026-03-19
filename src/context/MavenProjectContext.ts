import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MavenEvaluator } from '../commands/MavenEvaluator';


export interface MavenProjectInfo {
    pomPath:    string;
    groupId:    string;
    artifactId: string;
    version:    string;
    packaging:  string;
    hasParent:  boolean;
    hasModules: boolean;
}

export interface MavenGlobalConfig {
    localRepository: string;
}


export class MavenProjectContext {
    private static _current: MavenProjectInfo | undefined;
    private static _globalConfig: MavenGlobalConfig = { localRepository: '' };
    private static _onDidChange = new vscode.EventEmitter<MavenProjectInfo | undefined>();

    static readonly onDidChange = MavenProjectContext._onDidChange.event;

    static get current(): MavenProjectInfo | undefined {
        return MavenProjectContext._current;
    }
    static get globalConfig(): MavenGlobalConfig {
        return MavenProjectContext._globalConfig;
    }

    static activate(context: vscode.ExtensionContext): void {
        // Update when active editor changes
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                MavenProjectContext.updateFromEditor(editor);
            })
        );

        // Update when active pom.xml is saved
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc.fileName.endsWith('pom.xml')) {
                    MavenProjectContext.updateFromDocument(doc.uri.fsPath);
                }
            })
        );

        // Init with current editor
        MavenProjectContext.updateFromEditor(vscode.window.activeTextEditor);
 
        // Load global Maven config asynchronously at startup
		// Se retarda y se llama desde extension.ts
        // MavenProjectContext.loadGlobalConfig();
   }

    static async loadGlobalConfig(evaluator: MavenEvaluator, onLoaded?: () => void): Promise<void> {
        const poms = await vscode.workspace.findFiles('pom.xml', null, 1);
        if (poms.length === 0) { return; }
        const projectDir = path.dirname(poms[0].fsPath);

		MavenProjectContext.loadLocalRepository	(projectDir, evaluator);
		if (MavenProjectContext._globalConfig.localRepository) {
			onLoaded?.();
		}
    }

    static async loadLocalRepository(projectDir: string, evaluator: MavenEvaluator): Promise<void> {
        // Dynamic import to avoid circular dependencies
        const localRepository = await evaluator.evaluate('settings.localRepository', projectDir);
		if (localRepository) {
			MavenProjectContext._globalConfig = { localRepository };
			vscode.commands.executeCommand('setContext', 'gjsMaven.localRepository', localRepository);
			console.log(`Gjs Maven VS Code Extension: localRepository = ${localRepository}`);
		}
    }
	
    static updateFromEditor(editor: vscode.TextEditor | undefined): void {
        if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
            MavenProjectContext._current = undefined;
            vscode.commands.executeCommand('setContext', 'gjsMaven.isPom',    false);
            vscode.commands.executeCommand('setContext', 'gjsMaven.packaging',    '');
            vscode.commands.executeCommand('setContext', 'gjsMaven.isAggregator', false);
            vscode.commands.executeCommand('setContext', 'gjsMaven.hasParent',    false);
            MavenProjectContext._onDidChange.fire(undefined);
            return;
        }
        MavenProjectContext.updateFromDocument(editor.document.uri.fsPath);
    }

    private static updateFromDocument(pomPath: string): void {
        try {
            const text = fs.readFileSync(pomPath, 'utf8');

            // Read only the top-level project fields, not nested ones
            // Strip <parent> and <dependencies> blocks to avoid false matches
            const stripped = text
                .replace(/<parent>[\s\S]*?<\/parent>/g, '')
                .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, '')
                .replace(/<plugins>[\s\S]*?<\/plugins>/g, '');

            const groupId    = (stripped.match(/<groupId>([^<]+)/)    || [])[1]?.trim() ?? '';
            const artifactId = (stripped.match(/<artifactId>([^<]+)/) || [])[1]?.trim() ?? '';
            const version    = (stripped.match(/<version>([^<]+)/)    || [])[1]?.trim() ?? '';
            const packaging  = (stripped.match(/<packaging>([^<]+)/)  || [])[1]?.trim() ?? 'jar';
            const hasParent  = /<parent>/.test(text);
            const hasModules  = /<modules>/.test(text);

            MavenProjectContext._current = {
                pomPath,
                groupId,
                artifactId,
                version,
                packaging,
                hasParent,
				hasModules
            };
            vscode.commands.executeCommand('setContext', 'gjsMaven.isPom',    true);
            vscode.commands.executeCommand('setContext', 'gjsMaven.packaging',     packaging);
            vscode.commands.executeCommand('setContext', 'gjsMaven.isAggregator',  packaging === 'pom' && hasModules);
            vscode.commands.executeCommand('setContext', 'gjsMaven.hasParent',     hasParent);
            MavenProjectContext._onDidChange.fire(MavenProjectContext._current);
        } catch {
            MavenProjectContext._current = undefined;
            MavenProjectContext._onDidChange.fire(undefined);
        }
    }
}
