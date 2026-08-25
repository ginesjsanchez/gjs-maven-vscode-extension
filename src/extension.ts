import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MavenProjectsProvider } from './providers/MavenProjectsProvider';
import { MavenLifecycleProvider } from './providers/MavenLifecycleProvider';
import { MavenPluginsProvider, MavenManagedPluginsProvider, MavenDependenciesProvider, MavenManagedDependenciesProvider } from './providers/MavenPluginsProvider';
import { MavenCommandRunner } from './commands/MavenCommandRunner';
import { PomXmlCompletionProvider } from './providers/PomXmlCompletionProvider';
import { PomXmlHoverProvider } from './providers/PomXmlHoverProvider';
import { PomXmlDiagnosticsProvider } from './providers/PomXmlDiagnosticsProvider';
import { LanguageSupportManager } from './language/LanguageSupportManager';
import { MavenStatusBar } from './ui/MavenStatusBar';
import { MavenTaskProvider } from './tasks/MavenTaskProvider';
import { AddDependencyCommand } from './commands/AddDependencyCommand';
import { AddPluginCommand } from './commands/AddPluginCommand';
import { MavenProfileManager } from './commands/MavenProfileManager';
import { CygwinTerminalProvider } from './terminal/CygwinTerminalProvider';
import { MavenProfilesView } from './ui/MavenProfilesView';
import { MavenParentProvider } from './providers/MavenParentProvider';
import { MavenProjectContext } from './context/MavenProjectContext';
import { CygwinScriptRunner } from './commands/CygwinScriptRunner';
import { MavenOptionsManager } from './commands/MavenOptionsManager';
import { MavenOptionsView }    from './ui/MavenOptionsView';
import { MavenEvaluator } from './commands/MavenEvaluator';
import { MavenArchetypeRunner } from './commands/MavenArchetypeRunner';
import { MavenArchetypesView } from './ui/MavenArchetypesView';
import { AddPropertyCommand } from './commands/AddPropertyCommand';
import { MavenPropertiesProvider } from './providers/MavenPropertiesProvider';
import { MavenUpdateCommand } from './commands/MavenUpdateCommand';
import { CppPropertiesManager } from './cpp/CppPropertiesManager';
import { HeaderAssociationManager } from './cpp/HeaderAssociationManager';
import { ModuleLanguageStatus } from './ui/ModuleLanguageStatus';
import { ImportJavaModulesCommand } from './commands/ImportJavaModulesCommand';


let statusBar: MavenStatusBar;
let diagnosticsProvider: PomXmlDiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Gjs Maven VS Code Extension: Activating...');

	MavenProjectContext.activate(context);

    //  Core services 
    diagnosticsProvider = new PomXmlDiagnosticsProvider();
    const languageManager = new LanguageSupportManager(context);

    //  Tree view providers 
    const projectsProvider = new MavenProjectsProvider();
    const lifecycleProvider = new MavenLifecycleProvider();
    const pluginsProvider = new MavenPluginsProvider();
    const dependenciesProvider = new MavenDependenciesProvider();
	const managedPluginsProvider = new MavenManagedPluginsProvider();
	const managedDependenciesProvider = new MavenManagedDependenciesProvider();
	const parentProvider = new MavenParentProvider();		
	const propertiesProvider = new MavenPropertiesProvider();		

    vscode.window.registerTreeDataProvider('mavenProjects', projectsProvider);
    vscode.window.registerTreeDataProvider('mavenLifecycle', lifecycleProvider);
    vscode.window.registerTreeDataProvider('mavenPlugins', pluginsProvider);
    vscode.window.registerTreeDataProvider('mavenDependencies', dependenciesProvider);
	vscode.window.registerTreeDataProvider('mavenManagedPlugins', managedPluginsProvider);
	vscode.window.registerTreeDataProvider('mavenManagedDependencies', managedDependenciesProvider);
	vscode.window.registerTreeDataProvider('mavenParent', parentProvider);
	vscode.window.registerTreeDataProvider('mavenProperties', propertiesProvider);

    //  Status bar 
    statusBar = new MavenStatusBar();
    context.subscriptions.push(statusBar);

    const profileManager = new MavenProfileManager(context, statusBar);
	const optionsManager = new MavenOptionsManager(context);	
    const commandRunner = new MavenCommandRunner(context, profileManager, optionsManager);
    const evaluator = new MavenEvaluator(commandRunner);
    const mavenUpdateCommnad = new MavenUpdateCommand(commandRunner);

	// El contexto necesita el evaluador para resolver gjs.source.language heredado
	MavenProjectContext.setEvaluator(evaluator);

	//  includePath de C/C++ siguiendo al módulo activo
	const cppProperties = new CppPropertiesManager(context, mavenUpdateCommnad);
	cppProperties.activate();

	//  Cabeceras de los módulos en C, que VS Code toma por C++ de serie
	new HeaderAssociationManager(context).activate();

	//  Módulo y lenguaje activos en el panel Editor Language Status
	new ModuleLanguageStatus(context).activate();

	//  Acotar el servidor de Java a los módulos que son de Java, si hay una
	//  selección guardada de una vez anterior. Sin ella no hace absolutamente nada.
	const javaModules = new ImportJavaModulesCommand(commandRunner);
	javaModules.activate(context);

	const archetypeRunner = new MavenArchetypeRunner();

    //  Profiles webview
	// Se guarda la referencia: su ayuda muestra los perfiles del pom que se
	// está mirando, así que hay que refrescarla al cambiar de pom.
	const profilesView = new MavenProfilesView(context, profileManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(MavenProfilesView.viewId, profilesView)
    );

	//  MavenOptions webview 
    context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MavenOptionsView.viewId,
			new MavenOptionsView(context, optionsManager)
		)
	);

	//  Archetypes webview  
	const archetypesView = new MavenArchetypesView(context, archetypeRunner);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MavenArchetypesView.viewId,
			archetypesView
		)
	);	
	
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor?.document.fileName.endsWith('pom.xml')) {
			pluginsProvider.refresh();
			dependenciesProvider.refresh();
			managedPluginsProvider.refresh();
			managedDependenciesProvider.refresh();
			parentProvider.refresh();
			profilesView.refresh();
		}
	});

	// El pom activo aporta el icono y el color: sólo existe mientras miras un
	// pom.xml, así que por sí solo no sirve para dar nombre a la barra.
	MavenProjectContext.onDidChange(info => {
		statusBar.setPom(info, profileManager.getActiveProfiles());
	});

	// El módulo activo es el que pone el nombre: acompaña a cualquier fichero,
	// y no se pierde al pasar de un pom.xml a un fuente.
	context.subscriptions.push(
		MavenProjectContext.onDidChangeActiveModule(module => {
			statusBar.setModule(module, profileManager.getActiveProfiles());
		})
	);

    //  Cygwin terminal profile 
    new CygwinTerminalProvider().activate(context);
	
	// Cygwin Shell  file runner
	const cygwinScriptRunner = new CygwinScriptRunner();

    //  Language features for pom.xml 
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

    //  Diagnostics on pom.xml 
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
                managedDependenciesProvider.refresh();
                dependenciesProvider.refresh();
                managedPluginsProvider.refresh();
                pluginsProvider.refresh();
            }
        })
    );

    //  Language support (Java, C++, Python) 
    await languageManager.activate();

    //  Task provider 
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider('maven', new MavenTaskProvider(commandRunner))
    );

    //  Register commands 
    registerCommands(context, commandRunner, evaluator,  archetypeRunner, cygwinScriptRunner, projectsProvider, 
						propertiesProvider, managedDependenciesProvider, dependenciesProvider, managedPluginsProvider, 
						pluginsProvider, statusBar, profileManager, mavenUpdateCommnad, cppProperties,
						javaModules );

    //  Validate already-open pom.xml files 
    vscode.workspace.textDocuments.forEach(doc => {
        if (isPomXml(doc)) { diagnosticsProvider.validate(doc); }
    });
	
	// Se consultará el repositorio local y se lanzará la carga de arquetipos
	MavenProjectContext.loadGlobalConfig(evaluator, () => archetypesView.refresh());

    //  File watcher for pom.xml changes 
    const watcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
    watcher.onDidChange(() => projectsProvider.refresh());
    watcher.onDidCreate(() => projectsProvider.refresh());
    watcher.onDidDelete(() => projectsProvider.refresh());
    context.subscriptions.push(watcher);

    // Cebar con lo que ya se sepa: el módulo activo puede haberse resuelto antes
    // de que nos suscribiéramos a su evento, y entonces no habría llegado nunca.
    statusBar.setModule(MavenProjectContext.activeModule, profileManager.getActiveProfiles());
	
	const poms = await vscode.workspace.findFiles('./pom.xml', null, 1);
	if (poms.length > 0) {
		vscode.commands.executeCommand('gjs-maven-vscode-extension-explorer.focus');
	}

	// Forzar el estado inicial manualmente
	MavenProjectContext.updateFromEditor(vscode.window.activeTextEditor);	
	
    console.log('Gjs Maven VS Code Extension: Active ✔');
}


/**
 * Resolves the working directory from the context:
 * - If called from explorer/editor context menu: uses the directory of the clicked pom.xml
 * - If called from command palette or sidebar: asks the user if multiple pom.xml exist
 */
async function resolveProjectDir(uri?: vscode.Uri): Promise<string | undefined> {
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

function registerCommands(
    context: vscode.ExtensionContext,
    runner: MavenCommandRunner,
    evaluator: MavenEvaluator,
    archetypeRunner: MavenArchetypeRunner,
    cygwinRunner: CygwinScriptRunner,
    projects: MavenProjectsProvider,
    properties: MavenPropertiesProvider,
    managedDependencies: MavenManagedDependenciesProvider,
    dependencies: MavenDependenciesProvider,
    managedPlugins: MavenManagedPluginsProvider,
    plugins: MavenPluginsProvider,
    bar: MavenStatusBar,
    profileManager: MavenProfileManager,
	mavenUpdateCommnad: MavenUpdateCommand,
	cppProperties: CppPropertiesManager,
	javaModules: ImportJavaModulesCommand
) {
    const reg = (cmd: string, fn: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

    reg('gjs-maven-vscode-extension.runCommand', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const goals = await vscode.window.showQuickPick(
            ['clean', 'compile', 'test', 'package', 'install', 'deploy',
             'clean install', 'clean package', 'clean test', 'site', 'verify'],
            { placeHolder: 'Select Maven goal(s)' }
        );
        if (goals) { await runner.run(goals, dir, bar); }
    });

    reg('gjs-maven-vscode-extension.clean',        async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('clean', d, bar); } });
    reg('gjs-maven-vscode-extension.validate',     async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('validate', d, bar); } });
    reg('gjs-maven-vscode-extension.compile',      async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('compile', d, bar); } });
    reg('gjs-maven-vscode-extension.test',         async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('test', d, bar); } });
    reg('gjs-maven-vscode-extension.package',      async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('package', d, bar); } });
    reg('gjs-maven-vscode-extension.verify',       async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('verify', d, bar); } });
    reg('gjs-maven-vscode-extension.install',      async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('install', d, bar); } });
    reg('gjs-maven-vscode-extension.deploy',       async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('deploy', d, bar); } });
    reg('gjs-maven-vscode-extension.cleanPackage', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('clean package', d, bar); } });
    reg('gjs-maven-vscode-extension.cleanInstall', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('clean install', d, bar); } });
    reg('gjs-maven-vscode-extension.cleanDeploy',  async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('clean deploy', d, bar); } });
    reg('gjs-maven-vscode-extension.site',         async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('site', d, bar); } });

    reg('gjs-maven-vscode-extension.addProperty', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddPropertyCommand().execute(pomUri);
        properties.refresh();
    });
    reg('gjs-maven-vscode-extension.addManagedDependency', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddDependencyCommand().execute(pomUri, true);
        managedDependencies.refresh();
    });
    reg('gjs-maven-vscode-extension.addDependency', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddDependencyCommand().execute(pomUri, false);
        dependencies.refresh();
    });
    reg('gjs-maven-vscode-extension.addManagedPlugin', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddPluginCommand().execute(pomUri, true);
        managedPlugins.refresh();
    });
    reg('gjs-maven-vscode-extension.addPlugin', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await new AddPluginCommand().execute(pomUri, false);
        plugins.refresh();
    });
    reg('gjs-maven-vscode-extension.showEffectivePom', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (dir) { runner.showEffectivePom(dir); }
    });

	reg('gjs-maven-vscode-extension.manageProfiles',  () => vscode.commands.executeCommand('mavenProfiles.focus'));
    reg('gjs-maven-vscode-extension.showDependencyTree', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.runToOutput('dependency:tree', d, bar); } });
    reg('gjs-maven-vscode-extension.resolveDependencies', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.run('dependency:resolve', d, bar); } });
    reg('gjs-maven-vscode-extension.showAllProfiles', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.runToOutput('help:all-profiles', d, bar); } });
    reg('gjs-maven-vscode-extension.showActiveProfiles', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.runToOutput('help:active-profiles', d, bar); } });

    reg('gjs-maven-vscode-extension.mavenUpdate', async (uri?: vscode.Uri) => {
        // Sin uri explícita manda el módulo activo, nunca la raíz del workspace:
        // un Maven Update sobre un agregador arrastraría a todo el árbol.
        const dir = uri ? path.dirname(uri.fsPath) : MavenProjectContext.activeModule?.projectDir;
        if (!dir) {
            vscode.window.showErrorMessage('Maven Update: no hay ningún módulo Maven activo.');
            return;
        }
        const pomUri = vscode.Uri.file(path.join(dir, 'pom.xml'));
        await mavenUpdateCommnad.execute(pomUri);
        properties.refresh();
    });

    reg('gjs-maven-vscode-extension.customCommand', async (uri?: vscode.Uri) => {
        const dir = await resolveProjectDir(uri);
        if (!dir) { return; }
        const cmd = await vscode.window.showInputBox({
            placeHolder: 'e.g. clean install -DskipTests -P myProfile',
            prompt: 'Enter Maven goals and options'
        });
        if (cmd) { await runner.run(cmd, dir, bar); }
    });

    reg('gjs-maven-vscode-extension.refreshProjects', () => projects.refresh());

    reg('gjs-maven-vscode-extension.importJavaModules', () => javaModules.execute());
    reg('gjs-maven-vscode-extension.forgetJavaModules', () => javaModules.forget());

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
        const pick = await vscode.window.showQuickPick(
            poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
            { placeHolder: 'Select pom.xml to open' }
        );
        if (pick) { vscode.window.showTextDocument(pick.uri); }
    });

	reg('gjs-maven-vscode-extension.addProfile',    () => profileManager.addProfile());
	reg('gjs-maven-vscode-extension.removeProfile', () => profileManager.removeProfile());
	reg('gjs-maven-vscode-extension.clearProfiles', () => profileManager.clearProfiles());
	
	reg('gjs-maven-vscode-extension.runFromLifecycle', async (phase: string) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
			vscode.window.showWarningMessage('Please open a pom.xml file in the editor first.');
			return;
		}
		const dir = path.dirname(editor.document.uri.fsPath);
		runner.run(phase, dir, bar);
	});
	
	reg('gjs-maven-vscode-extension.setVersion', async (uri?: vscode.Uri) => {
		const dir = await resolveProjectDir(uri);
		if (!dir) { return; }
		const newVersion = await vscode.window.showInputBox({
			prompt: 'Enter new project version',
			placeHolder: 'e.g. 1.0.1',
			value: MavenProjectContext.current?.version ?? ''
		});
		if (!newVersion) { return; }
		runner.run(`versions:set -DnewVersion="${newVersion}" -DprocessAllModules=true`, dir, bar);
	});
    reg('gjs-maven-vscode-extension.updateProperties', async (uri?: vscode.Uri) => { const d = await resolveProjectDir(uri); if (d) { runner.runToOutput('versions:update-properties', d, bar); } });	
	
	reg('gjs-maven-vscode-extension.runInCygwin', async (uri?: vscode.Uri) => {
		if (!uri) {
			vscode.window.showWarningMessage('Right-click a .sh file to run it in Cygwin.');
			return;
		}
		cygwinRunner.run(uri);
    });
	
	reg('gjs-maven-vscode-extension.evaluate', async (uri?: vscode.Uri) => {
		const dir = await resolveProjectDir(uri);
		if (!dir) { return; }
		await evaluator.runInteractive(dir);
	});	
	
	reg('gjs-maven-vscode-extension.archetypeCrawl',    () => archetypeRunner.crawl());
	reg('gjs-maven-vscode-extension.archetypeGenerate', async (groupId?: string, artifactId?: string, version?: string) => {
		await archetypeRunner.generate(groupId, artifactId, version);
	});
	
	reg('gjs-maven-vscode-extension.openParentPom', async () => {
		const current = MavenProjectContext.current;
		if (!current?.hasParent) { return; }

		// Leer relativePath del parent del pom activo
		const text = fs.readFileSync(current.pomPath, 'utf8');
		const parentMatch = text.match(/<parent>([\s\S]*?)<\/parent>/);
		if (!parentMatch) { return; }

		const relativePath = ((parentMatch[1].match(/<relativePath>([^<]+)/) || [])[1]?.trim() ?? '..') + '/pom.xml';
		const parentPath = path.resolve(path.dirname(current.pomPath), relativePath);

		if (fs.existsSync(parentPath)) {
			const uri = vscode.Uri.file(parentPath);
			await vscode.window.showTextDocument(uri);
		} else {
			vscode.window.showWarningMessage(`Parent POM not found at: ${parentPath}`);
		}
	});
	
reg('gjs-maven-vscode-extension.save',    () => vscode.commands.executeCommand('workbench.action.files.save'));
reg('gjs-maven-vscode-extension.saveAll', () => vscode.commands.executeCommand('workbench.action.files.saveAll'));}

function isPomXml(doc: vscode.TextDocument): boolean {
    // doc.fileName es la ruta completa, no el nombre: compararla con 'pom.xml'
    // daba siempre false, y por eso resolveProjectDir se saltaba el caso del
    // editor activo y caía a la raíz del workspace.
    return path.basename(doc.fileName) === 'pom.xml' && doc.languageId === 'xml';
}

export function deactivate() {
    diagnosticsProvider?.dispose();
}
