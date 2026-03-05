import * as vscode from 'vscode';
import { MavenProjectsProvider } from './providers/MavenProjectsProvider';
import { MavenLifecycleProvider } from './providers/MavenLifecycleProvider';
import { MavenPluginsProvider } from './providers/MavenPluginsProvider';
import { MavenDependenciesProvider } from './providers/MavenDependenciesProvider';
import { MavenCommandRunner } from './commands/MavenCommandRunner';
import { PomXmlCompletionProvider } from './providers/PomXmlCompletionProvider';
import { PomXmlHoverProvider } from './providers/PomXmlHoverProvider';
import { PomXmlDiagnosticsProvider } from './providers/PomXmlDiagnosticsProvider';
import { LanguageSupportManager } from './language/LanguageSupportManager';
import { MavenStatusBar } from './ui/MavenStatusBar';
import { MavenTaskProvider } from './tasks/MavenTaskProvider';
import { AddDependencyCommand } from './commands/AddDependencyCommand';

let statusBar: MavenStatusBar;
let diagnosticsProvider: PomXmlDiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Gjs Maven VS Code Extension: Activating...');

    // ── Core services ──────────────────────────────────────────────
    const commandRunner = new MavenCommandRunner(context);
    diagnosticsProvider = new PomXmlDiagnosticsProvider();
    const languageManager = new LanguageSupportManager(context);

    // ── Tree view providers ────────────────────────────────────────
    const projectsProvider = new MavenProjectsProvider();
    const lifecycleProvider = new MavenLifecycleProvider();
    const pluginsProvider = new MavenPluginsProvider();
    const dependenciesProvider = new MavenDependenciesProvider();

    vscode.window.registerTreeDataProvider('mavenProjects', projectsProvider);
    vscode.window.registerTreeDataProvider('mavenLifecycle', lifecycleProvider);
    vscode.window.registerTreeDataProvider('mavenPlugins', pluginsProvider);
    vscode.window.registerTreeDataProvider('mavenDependencies', dependenciesProvider);

    // ── Status bar ─────────────────────────────────────────────────
    statusBar = new MavenStatusBar();
    context.subscriptions.push(statusBar);

    // ── Language features for pom.xml ──────────────────────────────
    const pomSelector: vscode.DocumentSelector = {
        language: 'xml',
        pattern: '**/pom.xml'
    };

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            pomSelector,
            new PomXmlCompletionProvider(),
            '<', ' ', '"', ':'
        )
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            pomSelector,
            new PomXmlHoverProvider()
        )
    );

    // ── Diagnostics on pom.xml ─────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (isPomXml(doc)) { diagnosticsProvider.validate(doc); }
        }),
        vscode.workspace.onDidChangeTextDocument(e => {
            if (isPomXml(e.document)) { diagnosticsProvider.validate(e.document); }
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (isPomXml(doc)) {
                diagnosticsProvider.validate(doc);
                projectsProvider.refresh();
                dependenciesProvider.refresh();
            }
        })
    );

    // ── Language support (Java, C++, Python) ───────────────────────
    await languageManager.activate();

    // ── Task provider ──────────────────────────────────────────────
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider('maven', new MavenTaskProvider(commandRunner))
    );

    // ── Register commands ──────────────────────────────────────────
    registerCommands(context, commandRunner, projectsProvider, dependenciesProvider, statusBar);

    // ── Validate already-open pom.xml files ───────────────────────
    vscode.workspace.textDocuments.forEach(doc => {
        if (isPomXml(doc)) { diagnosticsProvider.validate(doc); }
    });

    // ── File watcher for pom.xml changes ──────────────────────────
    const watcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
    watcher.onDidChange(() => projectsProvider.refresh());
    watcher.onDidCreate(() => projectsProvider.refresh());
    watcher.onDidDelete(() => projectsProvider.refresh());
    context.subscriptions.push(watcher);

    statusBar.setReady();
    console.log('Gjs Maven VS Code Extension: Active ✔');
}

function registerCommands(
    context: vscode.ExtensionContext,
    runner: MavenCommandRunner,
    projects: MavenProjectsProvider,
    dependencies: MavenDependenciesProvider,
    bar: MavenStatusBar
) {
    const reg = (cmd: string, fn: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

    reg('gjs-maven-vscode-extension.runCommand', async () => {
        const goals = await vscode.window.showQuickPick(
            ['clean', 'compile', 'test', 'package', 'install', 'deploy',
             'clean install', 'clean package', 'clean test', 'site', 'verify'],
            { placeHolder: 'Select Maven goal(s)' }
        );
        if (goals) { await runner.run(goals, bar); }
    });

    reg('gjs-maven-vscode-extension.clean',        () => runner.run('clean', bar));
    reg('gjs-maven-vscode-extension.compile',      () => runner.run('compile', bar));
    reg('gjs-maven-vscode-extension.test',         () => runner.run('test', bar));
    reg('gjs-maven-vscode-extension.package',      () => runner.run('package', bar));
    reg('gjs-maven-vscode-extension.install',      () => runner.run('install', bar));
    reg('gjs-maven-vscode-extension.verify',       () => runner.run('verify', bar));
    reg('gjs-maven-vscode-extension.deploy',       () => runner.run('deploy', bar));
    reg('gjs-maven-vscode-extension.cleanInstall', () => runner.run('clean install', bar));

    reg('gjs-maven-vscode-extension.addDependency', async () => {
        await new AddDependencyCommand().execute();
        dependencies.refresh();
    });

    reg('gjs-maven-vscode-extension.showEffectivePom', () => runner.showEffectivePom());
    reg('gjs-maven-vscode-extension.showDependencyTree', () => runner.run('dependency:tree', bar));

    reg('gjs-maven-vscode-extension.customCommand', async () => {
        const cmd = await vscode.window.showInputBox({
            placeHolder: 'e.g. clean install -DskipTests -P myProfile',
            prompt: 'Enter Maven goals and options'
        });
        if (cmd) { await runner.run(cmd, bar); }
    });

    reg('gjs-maven-vscode-extension.refreshProjects', () => projects.refresh());

    reg('gjs-maven-vscode-extension.openPom', async () => {
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**');
        if (poms.length === 0) {
            vscode.window.showWarningMessage('No pom.xml found in workspace.');
            return;
        }
        if (poms.length === 1) {
            vscode.window.showTextDocument(poms[0]);
            return;
        }
        const pick = await vscode.window.showQuickPick(
            poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
            { placeHolder: 'Select pom.xml to open' }
        );
        if (pick) { vscode.window.showTextDocument(pick.uri); }
    });
}

function isPomXml(doc: vscode.TextDocument): boolean {
    return doc.fileName.endsWith('pom.xml') && doc.languageId === 'xml';
}

export function deactivate() {
    diagnosticsProvider?.dispose();
}
