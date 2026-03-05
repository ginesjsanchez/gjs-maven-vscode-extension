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
const MavenProjectsProvider_1 = require("./providers/MavenProjectsProvider");
const MavenLifecycleProvider_1 = require("./providers/MavenLifecycleProvider");
const MavenPluginsProvider_1 = require("./providers/MavenPluginsProvider");
const MavenDependenciesProvider_1 = require("./providers/MavenDependenciesProvider");
const MavenCommandRunner_1 = require("./commands/MavenCommandRunner");
const PomXmlCompletionProvider_1 = require("./providers/PomXmlCompletionProvider");
const PomXmlHoverProvider_1 = require("./providers/PomXmlHoverProvider");
const PomXmlDiagnosticsProvider_1 = require("./providers/PomXmlDiagnosticsProvider");
const LanguageSupportManager_1 = require("./language/LanguageSupportManager");
const MavenStatusBar_1 = require("./ui/MavenStatusBar");
const MavenTaskProvider_1 = require("./tasks/MavenTaskProvider");
const AddDependencyCommand_1 = require("./commands/AddDependencyCommand");
let statusBar;
let diagnosticsProvider;
async function activate(context) {
    console.log('Gjs Maven VS Code Extension: Activating...');
    // ── Core services ──────────────────────────────────────────────
    const commandRunner = new MavenCommandRunner_1.MavenCommandRunner(context);
    diagnosticsProvider = new PomXmlDiagnosticsProvider_1.PomXmlDiagnosticsProvider();
    const languageManager = new LanguageSupportManager_1.LanguageSupportManager(context);
    // ── Tree view providers ────────────────────────────────────────
    const projectsProvider = new MavenProjectsProvider_1.MavenProjectsProvider();
    const lifecycleProvider = new MavenLifecycleProvider_1.MavenLifecycleProvider();
    const pluginsProvider = new MavenPluginsProvider_1.MavenPluginsProvider();
    const dependenciesProvider = new MavenDependenciesProvider_1.MavenDependenciesProvider();
    vscode.window.registerTreeDataProvider('mavenProjects', projectsProvider);
    vscode.window.registerTreeDataProvider('mavenLifecycle', lifecycleProvider);
    vscode.window.registerTreeDataProvider('mavenPlugins', pluginsProvider);
    vscode.window.registerTreeDataProvider('mavenDependencies', dependenciesProvider);
    // ── Status bar ─────────────────────────────────────────────────
    statusBar = new MavenStatusBar_1.MavenStatusBar();
    context.subscriptions.push(statusBar);
    // ── Language features for pom.xml ──────────────────────────────
    const pomSelector = {
        language: 'xml',
        pattern: '**/pom.xml'
    };
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(pomSelector, new PomXmlCompletionProvider_1.PomXmlCompletionProvider(), '<', ' ', '"', ':'));
    context.subscriptions.push(vscode.languages.registerHoverProvider(pomSelector, new PomXmlHoverProvider_1.PomXmlHoverProvider()));
    // ── Diagnostics on pom.xml ─────────────────────────────────────
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
            dependenciesProvider.refresh();
        }
    }));
    // ── Language support (Java, C++, Python) ───────────────────────
    await languageManager.activate();
    // ── Task provider ──────────────────────────────────────────────
    context.subscriptions.push(vscode.tasks.registerTaskProvider('maven', new MavenTaskProvider_1.MavenTaskProvider(commandRunner)));
    // ── Register commands ──────────────────────────────────────────
    registerCommands(context, commandRunner, projectsProvider, dependenciesProvider, statusBar);
    // ── Validate already-open pom.xml files ───────────────────────
    vscode.workspace.textDocuments.forEach(doc => {
        if (isPomXml(doc)) {
            diagnosticsProvider.validate(doc);
        }
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
function registerCommands(context, runner, projects, dependencies, bar) {
    const reg = (cmd, fn) => context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));
    reg('gjs-maven-vscode-extension.runCommand', async () => {
        const goals = await vscode.window.showQuickPick(['clean', 'compile', 'test', 'package', 'install', 'deploy',
            'clean install', 'clean package', 'clean test', 'site', 'verify'], { placeHolder: 'Select Maven goal(s)' });
        if (goals) {
            await runner.run(goals, bar);
        }
    });
    reg('gjs-maven-vscode-extension.clean', () => runner.run('clean', bar));
    reg('gjs-maven-vscode-extension.compile', () => runner.run('compile', bar));
    reg('gjs-maven-vscode-extension.test', () => runner.run('test', bar));
    reg('gjs-maven-vscode-extension.package', () => runner.run('package', bar));
    reg('gjs-maven-vscode-extension.install', () => runner.run('install', bar));
    reg('gjs-maven-vscode-extension.verify', () => runner.run('verify', bar));
    reg('gjs-maven-vscode-extension.deploy', () => runner.run('deploy', bar));
    reg('gjs-maven-vscode-extension.cleanInstall', () => runner.run('clean install', bar));
    reg('gjs-maven-vscode-extension.addDependency', async () => {
        await new AddDependencyCommand_1.AddDependencyCommand().execute();
        dependencies.refresh();
    });
    reg('gjs-maven-vscode-extension.showEffectivePom', () => runner.showEffectivePom());
    reg('gjs-maven-vscode-extension.showDependencyTree', () => runner.run('dependency:tree', bar));
    reg('gjs-maven-vscode-extension.customCommand', async () => {
        const cmd = await vscode.window.showInputBox({
            placeHolder: 'e.g. clean install -DskipTests -P myProfile',
            prompt: 'Enter Maven goals and options'
        });
        if (cmd) {
            await runner.run(cmd, bar);
        }
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
        const pick = await vscode.window.showQuickPick(poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })), { placeHolder: 'Select pom.xml to open' });
        if (pick) {
            vscode.window.showTextDocument(pick.uri);
        }
    });
}
function isPomXml(doc) {
    return doc.fileName.endsWith('pom.xml') && doc.languageId === 'xml';
}
function deactivate() {
    diagnosticsProvider?.dispose();
}
//# sourceMappingURL=extension.js.map