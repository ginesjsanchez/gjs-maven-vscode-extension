"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const MavenProjectsProvider_1 = require("./providers/MavenProjectsProvider");
const MavenLifecycleProvider_1 = require("./providers/MavenLifecycleProvider");
const MavenPluginsProvider_1 = require("./providers/MavenPluginsProvider");
const MavenCommandRunner_1 = require("./commands/MavenCommandRunner");
const PomXmlCompletionProvider_1 = require("./providers/PomXmlCompletionProvider");
const PomXmlHoverProvider_1 = require("./providers/PomXmlHoverProvider");
const PomXmlDiagnosticsProvider_1 = require("./providers/PomXmlDiagnosticsProvider");
const LanguageSupportManager_1 = require("./language/LanguageSupportManager");
const MavenStatusBar_1 = require("./ui/MavenStatusBar");
const MavenTaskProvider_1 = require("./tasks/MavenTaskProvider");
const AddDependencyCommand_1 = require("./commands/AddDependencyCommand");
const AddPluginCommand_1 = require("./commands/AddPluginCommand");
const MavenProfileManager_1 = require("./commands/MavenProfileManager");
const CygwinTerminalProvider_1 = require("./terminal/CygwinTerminalProvider");
const MavenProfilesView_1 = require("./ui/MavenProfilesView");
const MavenParentProvider_1 = require("./providers/MavenParentProvider");
const MavenProjectContext_1 = require("./context/MavenProjectContext");
const CygwinScriptRunner_1 = require("./commands/CygwinScriptRunner");
const MavenOptionsManager_1 = require("./commands/MavenOptionsManager");
const MavenOptionsView_1 = require("./ui/MavenOptionsView");
const MavenEvaluator_1 = require("./commands/MavenEvaluator");
const MavenArchetypeRunner_1 = require("./commands/MavenArchetypeRunner");
const MavenArchetypesView_1 = require("./ui/MavenArchetypesView");
const AddPropertyCommand_1 = require("./commands/AddPropertyCommand");
const MavenPropertiesProvider_1 = require("./providers/MavenPropertiesProvider");
let statusBar;
let diagnosticsProvider;
async function activate(context) {
    console.log('Gjs Maven VS Code Extension: Activating...');
    MavenProjectContext_1.MavenProjectContext.activate(context);
    //  Core services 
    diagnosticsProvider = new PomXmlDiagnosticsProvider_1.PomXmlDiagnosticsProvider();
    const languageManager = new LanguageSupportManager_1.LanguageSupportManager(context);
    //  Tree view providers 
    const projectsProvider = new MavenProjectsProvider_1.MavenProjectsProvider();
    const lifecycleProvider = new MavenLifecycleProvider_1.MavenLifecycleProvider();
    const pluginsProvider = new MavenPluginsProvider_1.MavenPluginsProvider();
    const dependenciesProvider = new MavenPluginsProvider_1.MavenDependenciesProvider();
    const managedPluginsProvider = new MavenPluginsProvider_1.MavenManagedPluginsProvider();
    const managedDependenciesProvider = new MavenPluginsProvider_1.MavenManagedDependenciesProvider();
    const parentProvider = new MavenParentProvider_1.MavenParentProvider();
    const propertiesProvider = new MavenPropertiesProvider_1.MavenPropertiesProvider();
    vscode.window.registerTreeDataProvider('mavenProjects', projectsProvider);
    vscode.window.registerTreeDataProvider('mavenLifecycle', lifecycleProvider);
    vscode.window.registerTreeDataProvider('mavenPlugins', pluginsProvider);
    vscode.window.registerTreeDataProvider('mavenDependencies', dependenciesProvider);
    vscode.window.registerTreeDataProvider('mavenManagedPlugins', managedPluginsProvider);
    vscode.window.registerTreeDataProvider('mavenManagedDependencies', managedDependenciesProvider);
    vscode.window.registerTreeDataProvider('mavenParent', parentProvider);
    vscode.window.registerTreeDataProvider('mavenProperties', propertiesProvider);
    //  Status bar 
    statusBar = new MavenStatusBar_1.MavenStatusBar();
    context.subscriptions.push(statusBar);
    const profileManager = new MavenProfileManager_1.MavenProfileManager(context, statusBar);
    const optionsManager = new MavenOptionsManager_1.MavenOptionsManager(context);
    const commandRunner = new MavenCommandRunner_1.MavenCommandRunner(context, profileManager, optionsManager);
    const evaluator = new MavenEvaluator_1.MavenEvaluator(commandRunner);
    const archetypeRunner = new MavenArchetypeRunner_1.MavenArchetypeRunner();
    //  Profiles webview 
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(MavenProfilesView_1.MavenProfilesView.viewId, new MavenProfilesView_1.MavenProfilesView(context, profileManager)));
    //  MavenOptions webview 
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(MavenOptionsView_1.MavenOptionsView.viewId, new MavenOptionsView_1.MavenOptionsView(context, optionsManager)));
    //  Archetypes webview  
    const archetypesView = new MavenArchetypesView_1.MavenArchetypesView(context, archetypeRunner);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(MavenArchetypesView_1.MavenArchetypesView.viewId, archetypesView));
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor?.document.fileName.endsWith('pom.xml')) {
            pluginsProvider.refresh();
            dependenciesProvider.refresh();
            managedPluginsProvider.refresh();
            managedDependenciesProvider.refresh();
            parentProvider.refresh();
        }
    });
    MavenProjectContext_1.MavenProjectContext.onDidChange(info => {
        const profiles = profileManager.getActiveProfiles();
        if (!info) {
            statusBar.setReady(profiles);
            return;
        }
        if (info.packaging === 'pom' && info.hasModules) {
            statusBar.setAggregator(info.artifactId, profiles);
        }
        else if (info.packaging === 'pom') {
            statusBar.setParent(info.artifactId, profiles);
        }
        else if (info.packaging === 'maven-archetype') {
            statusBar.setArchetype(info.artifactId, profiles);
        }
        else {
            statusBar.setReady(profiles);
        }
    });
    //  Cygwin terminal profile 
    new CygwinTerminalProvider_1.CygwinTerminalProvider().activate(context);
    // Cygwin Shell  file runner
    const cygwinScriptRunner = new CygwinScriptRunner_1.CygwinScriptRunner();
    //  Language features for pom.xml 
    const pomSelector = {
        language: 'xml',
        pattern: '**/pom.xml'
    };
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(pomSelector, new PomXmlCompletionProvider_1.PomXmlCompletionProvider(), '<', ' ', '"', ':'));
    context.subscriptions.push(vscode.languages.registerHoverProvider(pomSelector, new PomXmlHoverProvider_1.PomXmlHoverProvider()));
    //  Diagnostics on pom.xml 
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (isPomXml(doc)) {
            diagnosticsProvider.validate(doc);
        }
    }), vscode.workspace.onDidChangeTextDocument(e => {
        if (isPomXml(e.document)) {
            diagnosticsProvider.validate(e.document);
        }
    }), vscode.workspace.onDidSaveTextDocument(doc => {
        if (isPomXml(doc)) {
            diagnosticsProvider.validate(doc);
            projectsProvider.refresh();
            managedDependenciesProvider.refresh();
            dependenciesProvider.refresh();
            managedPluginsProvider.refresh();
            pluginsProvider.refresh();
        }
    }));
    //  Language support (Java, C++, Python) 
    await languageManager.activate();
    //  Task provider 
    context.subscriptions.push(vscode.tasks.registerTaskProvider('maven', new MavenTaskProvider_1.MavenTaskProvider(commandRunner)));
    //  Register commands 
    registerCommands(context, commandRunner, evaluator, archetypeRunner, cygwinScriptRunner, projectsProvider, propertiesProvider, managedDependenciesProvider, dependenciesProvider, managedPluginsProvider, pluginsProvider, statusBar, profileManager);
    //  Validate already-open pom.xml files 
    vscode.workspace.textDocuments.forEach(doc => {
        if (isPomXml(doc)) {
            diagnosticsProvider.validate(doc);
        }
    });
    // Se consultará el repositorio local y se lanzará la carga de arquetipos
    MavenProjectContext_1.MavenProjectContext.loadGlobalConfig(evaluator, () => archetypesView.refresh());
    //  File watcher for pom.xml changes 
    const watcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
    watcher.onDidChange(() => projectsProvider.refresh());
    watcher.onDidCreate(() => projectsProvider.refresh());
    watcher.onDidDelete(() => projectsProvider.refresh());
    context.subscriptions.push(watcher);
    statusBar.setReady(profileManager.getActiveProfiles());
    const poms = await vscode.workspace.findFiles('./pom.xml', null, 1);
    if (poms.length > 0) {
        vscode.commands.executeCommand('gjs-maven-vscode-extension-explorer.focus');
    }
    // Forzar el estado inicial manualmente
    MavenProjectContext_1.MavenProjectContext.updateFromEditor(vscode.window.activeTextEditor);
    console.log('Gjs Maven VS Code Extension: Active ✔');
}
/**
 * Resolves the working directory from the context:
 * - If called from explorer/editor context menu: uses the directory of the clicked pom.xml
 * - If called from command palette or sidebar: asks the user if multiple pom.xml exist
 */
async function resolveProjectDir(uri) {
    // From context menu: use exactly the pom.xml that was right-clicked
    if (uri) {
        return path.dirname(uri.fsPath);
    }
    // From command palette: use active editor if it is a pom.xml
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc && isPomXml(activeDoc)) {
        return path.dirname(activeDoc.uri.fsPath);
    }
    // Last resort: workspace root
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return undefined;
    }
    return folders[0].uri.fsPath;
}
function registerCommands(context, runner, evaluator, archetypeRunner, cygwinRunner, projects, properties, managedDependencies, dependencies, managedPlugins, plugins, bar, profileManager) {
    const reg = (cmd, fn) => context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));
    reg('gjs-maven-vscode-extension.runCommand', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const goals = await vscode.window.showQuickPick(['clean', 'compile', 'test', 'package', 'install', 'deploy',
            'clean install', 'clean package', 'clean test', 'site', 'verify'], { placeHolder: 'Select Maven goal(s)' });
        if (goals) {
            await runner.run(goals, dir, bar);
        }
    });
    reg('gjs-maven-vscode-extension.clean', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('clean', d, bar);
    } });
    reg('gjs-maven-vscode-extension.validate', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('validate', d, bar);
    } });
    reg('gjs-maven-vscode-extension.compile', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('compile', d, bar);
    } });
    reg('gjs-maven-vscode-extension.test', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('test', d, bar);
    } });
    reg('gjs-maven-vscode-extension.package', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('package', d, bar);
    } });
    reg('gjs-maven-vscode-extension.verify', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('verify', d, bar);
    } });
    reg('gjs-maven-vscode-extension.install', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('install', d, bar);
    } });
    reg('gjs-maven-vscode-extension.deploy', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('deploy', d, bar);
    } });
    reg('gjs-maven-vscode-extension.cleanPackage', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('clean package', d, bar);
    } });
    reg('gjs-maven-vscode-extension.cleanInstall', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('clean install', d, bar);
    } });
    reg('gjs-maven-vscode-extension.cleanDeploy', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('clean deploy', d, bar);
    } });
    reg('gjs-maven-vscode-extension.site', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.run('site', d, bar);
    } });
    reg('gjs-maven-vscode-extension.addProperty', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddPropertyCommand_1.AddPropertyCommand().execute(pomUri);
        properties.refresh();
    });
    reg('gjs-maven-vscode-extension.addManagedDependency', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddDependencyCommand_1.AddDependencyCommand().execute(pomUri, true);
        managedDependencies.refresh();
    });
    reg('gjs-maven-vscode-extension.addDependency', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddDependencyCommand_1.AddDependencyCommand().execute(pomUri, false);
        dependencies.refresh();
    });
    reg('gjs-maven-vscode-extension.addManagedPlugin', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddPluginCommand_1.AddPluginCommand().execute(pomUri, true);
        managedPlugins.refresh();
    });
    reg('gjs-maven-vscode-extension.addPlugin', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddPluginCommand_1.AddPluginCommand().execute(pomUri, false);
        plugins.refresh();
    });
    reg('gjs-maven-vscode-extension.showEffectivePom', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (dir) {
            runner.showEffectivePom(dir);
        }
    });
    reg('gjs-maven-vscode-extension.manageProfiles', () => vscode.commands.executeCommand('mavenProfiles.focus'));
    reg('gjs-maven-vscode-extension.showDependencyTree', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.runToOutput('dependency:tree', d, bar);
    } });
    reg('gjs-maven-vscode-extension.showAllProfiles', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.runToOutput('help:all-profiles', d, bar);
    } });
    reg('gjs-maven-vscode-extension.showActiveProfiles', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.runToOutput('help:active-profiles', d, bar);
    } });
    reg('gjs-maven-vscode-extension.customCommand', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const cmd = await vscode.window.showInputBox({
            placeHolder: 'e.g. clean install -DskipTests -P myProfile',
            prompt: 'Enter Maven goals and options'
        });
        if (cmd) {
            await runner.run(cmd, dir, bar);
        }
    });
    reg('gjs-maven-vscode-extension.refreshProjects', () => projects.refresh());
    reg('gjs-maven-vscode-extension.openPom', async () => {
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/target/**,**/archetype-resources/**,**/node_modules/**', 50);
        if (poms.length === 0) {
            vscode.window.showWarningMessage('No pom.xml found in workspace.');
            return;
        }
        if (poms.length === 1) {
            vscode.window.showTextDocument(poms[0]);
            return;
        }
        const pick = await vscode.window.showQuickPick(poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })), { placeHolder: 'Select pom.xml to open' });
        if (pick) {
            vscode.window.showTextDocument(pick.uri);
        }
    });
    reg('gjs-maven-vscode-extension.addProfile', () => profileManager.addProfile());
    reg('gjs-maven-vscode-extension.removeProfile', () => profileManager.removeProfile());
    reg('gjs-maven-vscode-extension.clearProfiles', () => profileManager.clearProfiles());
    reg('gjs-maven-vscode-extension.runFromLifecycle', async (phase) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
            vscode.window.showWarningMessage('Please open a pom.xml file in the editor first.');
            return;
        }
        const dir = path.dirname(editor.document.uri.fsPath);
        runner.run(phase, dir, bar);
    });
    reg('gjs-maven-vscode-extension.setVersion', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        const newVersion = await vscode.window.showInputBox({
            prompt: 'Enter new project version',
            placeHolder: 'e.g. 1.0.1',
            value: MavenProjectContext_1.MavenProjectContext.current?.version ?? ''
        });
        if (!newVersion) {
            return;
        }
        runner.run(`versions:set -DnewVersion="${newVersion}" -DprocessAllModules=true`, dir, bar);
    });
    reg('gjs-maven-vscode-extension.updateProperties', async (uri) => { const d = await resolveProjectDir(uri); if (d) {
        runner.runToOutput('versions:update-properties', d, bar);
    } });
    reg('gjs-maven-vscode-extension.runInCygwin', async (uri) => {
        if (!uri) {
            vscode.window.showWarningMessage('Right-click a .sh file to run it in Cygwin.');
            return;
        }
        cygwinRunner.run(uri);
    });
    reg('gjs-maven-vscode-extension.evaluate', async (uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) {
            return;
        }
        await evaluator.runInteractive(dir);
    });
    reg('gjs-maven-vscode-extension.archetypeCrawl', () => archetypeRunner.crawl());
    reg('gjs-maven-vscode-extension.archetypeGenerate', async (groupId, artifactId, version) => {
        await archetypeRunner.generate(groupId, artifactId, version);
    });
    reg('gjs-maven-vscode-extension.openParentPom', async () => {
        const current = MavenProjectContext_1.MavenProjectContext.current;
        if (!current?.hasParent) {
            return;
        }
        // Leer relativePath del parent del pom activo
        const text = fs.readFileSync(current.pomPath, 'utf8');
        const parentMatch = text.match(/<parent>([\s\S]*?)<\/parent>/);
        if (!parentMatch) {
            return;
        }
        const relativePath = ((parentMatch[1].match(/<relativePath>([^<]+)/) || [])[1]?.trim() ?? '..') + '/pom.xml';
        const parentPath = path.resolve(path.dirname(current.pomPath), relativePath);
        if (fs.existsSync(parentPath)) {
            const uri = vscode.Uri.file(parentPath);
            await vscode.window.showTextDocument(uri);
        }
        else {
            vscode.window.showWarningMessage(`Parent POM not found at: ${parentPath}`);
        }
    });
    reg('gjs-maven-vscode-extension.save', () => vscode.commands.executeCommand('workbench.action.files.save'));
    reg('gjs-maven-vscode-extension.saveAll', () => vscode.commands.executeCommand('workbench.action.files.saveAll'));
}
function isPomXml(doc) {
    return doc.fileName == 'pom.xml' && doc.languageId === 'xml';
}
function deactivate() {
    diagnosticsProvider?.dispose();
}
//# sourceMappingURL=extension.js.map