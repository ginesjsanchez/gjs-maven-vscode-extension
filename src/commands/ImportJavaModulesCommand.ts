import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { MavenCommandRunner } from './MavenCommandRunner';

/**
 * Comandos internos de redhat.java. No están documentados ni forman parte de su
 * API pública: son los que su propio flujo de importación manual usa por debajo.
 * Todo lo que dependa de ellos va envuelto en try/catch, porque una versión
 * nueva de la extensión puede renombrarlos o quitarlos sin previo aviso.
 */
const JAVA_BRIDGE           = 'java.execute.workspaceCommand';
const JAVA_GET_ALL          = 'java.project.getAll';
const JAVA_CHANGE_IMPORTED  = 'java.project.changeImportedProjects';

/**
 * Contenedor invisible donde jdt.ls mete los ficheros que no pertenecen a
 * ningún proyecto. No es un módulo y no se debe soltar; redhat.java lo filtra
 * igual en su propio flujo.
 */
const DEFAULT_PROJECT = 'jdt.ls-java-project';

/** Fichero temporal con el pom efectivo de todo el reactor. */
const EFFECTIVE_POM = path.join('target', 'gjs-effective-pom.xml');

/**
 * Selección guardada, y a la vez el interruptor de la función: si el fichero
 * está, se reaplica en cada arranque; si lo borras, se acabó.
 *
 * Va en un JSON y no en el workspaceState a propósito. Una lista de módulos es
 * algo que conviene poder mirar y corregir a mano, y el estado interno de VS
 * Code es opaco: si algo sale torcido, el usuario no tiene dónde asomarse.
 */
const SELECTION_FILE = path.join('.vscode', 'gjs-maven-java-modules.json');

/**
 * La importación llega por tandas ('Progressive import: reporting N new
 * project(s)'), así que se espera a que amaine antes de reaplicar.
 */
const SETTLE_MS = 1500;

interface ModuleInfo {
    projectDir: string;
    artifactId: string;
    packaging:  string;
    language?:  string;
}

interface StoredSelection {
    generated: string;
    /** Rutas relativas a la carpeta del workspace, para que el fichero viaje. */
    modules: string[];
}

/**
 * Deja en el servidor de Java solo los módulos que son de Java.
 *
 * El problema que resuelve: en un árbol multimódulo con un agregador en la
 * raíz, redhat.java importa el reactor entero. java.import.exclusions no sirve
 * —filtra el rastreo de ficheros por disco, no los módulos del reactor— y su
 * selección manual te planta una lista de todos los pom.xml para que los
 * distingas a ojo. En un árbol de 120 módulos eso no es una opción.
 *
 * Aquí el lenguaje de cada módulo ya lo sabemos: sale de gjs.source.language
 * del pom efectivo. Así que en vez de pasar por su lista, calculamos nosotros
 * las tres listas que su flujo acaba construyendo y llamamos al mismo comando
 * del servidor que llama él.
 */
export class ImportJavaModulesCommand {

    private timer: NodeJS.Timeout | undefined;

    constructor(private runner: MavenCommandRunner) {}

    /**
     * Reaplica la selección guardada en cada arranque.
     *
     * Hace falta porque soltar proyectos NO persiste: con projectSelection en
     * 'automatic' —su valor por defecto— cada arranque reimporta el reactor
     * entero. Medido: 119 importados, 96 tras soltar, 120 otra vez al recargar.
     *
     * Llegamos tarde a propósito: no evitamos la importación, la deshacemos. La
     * alternativa sería 'manual', que arranca el servidor en LightWeight en cada
     * arranque y deja al usuario sin Java hasta que importe a mano.
     */
    activate(context: vscode.ExtensionContext): void {
        if (!this.stored()) { return; }

        const java = vscode.extensions.getExtension('redhat.java');
        if (!java) { return; }

        void java.activate().then(api => {
            // onDidProjectsImport sí es API pública suya, a diferencia del
            // comando con el que luego se aplica el cambio.
            const listener = api?.onDidProjectsImport?.(() => this.schedule(context));
            if (listener) { context.subscriptions.push(listener); }
        }, () => { /* si no arranca, no hay nada que reaplicar */ });
    }

    private schedule(context: vscode.ExtensionContext): void {
        if (this.timer) { clearTimeout(this.timer); }
        this.timer = setTimeout(() => void this.reapply(context), SETTLE_MS);
    }

    /** Vuelve a soltar lo que no es Java, sin volver a preguntarle a Maven. */
    private async reapply(_context: vscode.ExtensionContext): Promise<void> {
        const channel = ImportJavaModulesCommand.getOutputChannel();
        const stored = this.stored();
        if (!stored) { return; }

        try {
            const imported = await this.importedProjects(channel);
            const { toImport, toUpdate, toDelete } = this.plan(stored.modules, imported);
            if (toDelete.length === 0) { return; }

            await vscode.commands.executeCommand(
                JAVA_BRIDGE, JAVA_CHANGE_IMPORTED, toImport, toUpdate, toDelete);
            channel.appendLine(
                `Selección reaplicada tras la importación: ${toDelete.length} proyectos soltados.`);
        } catch (err: any) {
            channel.appendLine(`No se pudo reaplicar la selección: ${err.message}`);
        }
    }

    //  Persistencia

    private selectionPath(): string | undefined {
        const folder = vscode.workspace.workspaceFolders?.[0];
        return folder ? path.join(folder.uri.fsPath, SELECTION_FILE) : undefined;
    }

    /**
     * Selección guardada, con las rutas ya resueltas y los módulos que ya no
     * existen descartados: el fichero puede quedarse viejo o venir editado.
     */
    private stored(): { modules: string[] } | undefined {
        const file = this.selectionPath();
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!file || !root || !fs.existsSync(file)) { return undefined; }

        try {
            const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredSelection;
            const modules = (parsed?.modules ?? [])
                .map(relative => path.resolve(root, relative))
                .filter(dir => fs.existsSync(path.join(dir, 'pom.xml')));
            return modules.length > 0 ? { modules } : undefined;
        } catch {
            return undefined;
        }
    }

    private save(modules: ModuleInfo[]): void {
        const file = this.selectionPath();
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!file || !root) { return; }

        const contents: StoredSelection = {
            generated: new Date().toISOString(),
            modules: modules.map(m => path.relative(root, m.projectDir).replace(/\\/g, '/'))
        };
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(contents, null, 2) + '\n', 'utf8');
    }

    /** Apaga la función: sin fichero no se reaplica nada. */
    async forget(): Promise<void> {
        const file = this.selectionPath();
        if (!file || !fs.existsSync(file)) {
            vscode.window.showInformationMessage('No hay ninguna selección guardada.');
            return;
        }
        fs.unlinkSync(file);
        vscode.window.showInformationMessage(
            'Selección olvidada. El servidor de Java volverá a importar todo en el próximo arranque.');
    }

    async execute(): Promise<void> {
        const channel = ImportJavaModulesCommand.getOutputChannel();
        channel.show(true);

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No hay ninguna carpeta abierta.');
            return;
        }
        const rootDir = folders[0].uri.fsPath;

        if (!this.javaServerReady(channel)) { return; }

        try {
            const modules = await this.classify(rootDir, channel);
            if (modules.length === 0) {
                vscode.window.showWarningMessage(
                    'No se pudo clasificar ningún módulo. Revisa la salida de GJS Maven: Java Import.');
                return;
            }

            const imported = await this.importedProjects(channel);
            const java = modules.filter(m => this.isJavaCode(m));

            channel.appendLine(`\n${modules.length} módulos, ${java.length} de Java, ${imported.length} importados ahora.`);

            const javaDirs = java.map(m => m.projectDir);
            const { toImport, toUpdate, toDelete } = this.plan(javaDirs, imported);

            if (toImport.length === 0 && toDelete.length === 0 && this.stored()) {
                vscode.window.showInformationMessage(
                    `El servidor de Java ya tiene justo los ${java.length} módulos de Java.`);
                return;
            }

            const ok = await vscode.window.showWarningMessage(
                `Se importarán ${toImport.length} módulos de Java y se soltarán ${toDelete.length} que no lo son.\n\n` +
                'La selección se guardará y se volverá a aplicar en cada arranque, porque el ' +
                'servidor de Java reimporta todo el reactor cada vez.',
                { modal: true }, 'Aplicar');
            if (ok !== 'Aplicar') { channel.appendLine('Cancelado.'); return; }

            await vscode.commands.executeCommand(
                JAVA_BRIDGE, JAVA_CHANGE_IMPORTED, toImport, toUpdate, toDelete);

            // Guardar después de aplicar: si lo de arriba falla, no queremos
            // dejar activada una reaplicación que nunca llegó a funcionar.
            this.save(java);

            channel.appendLine(`✅ Selección aplicada y guardada en ${SELECTION_FILE}`);
            vscode.window.showInformationMessage(
                `Servidor de Java: ${java.length} módulos de Java, ${toDelete.length} soltados.`);

        } catch (err: any) {
            channel.appendLine(`❌ ${err.message}`);
            vscode.window.showErrorMessage(`No se pudo ajustar la importación de Java: ${err.message}`);
        }
    }

    /**
     * Módulo con código Java propio.
     *
     * No basta con el lenguaje: un parent declara gjs.source.language para su
     * descendencia, no para sí mismo, así que los pom de gjs-java salen todos
     * como 'java' sin tener una sola clase. Medido sobre el árbol de gjs: 35
     * módulos con lenguaje 'java', de los que 14 son parents. Es el mismo
     * criterio que aplica MavenProjectContext.isLanguageless() en el resto de
     * la extensión.
     *
     * Dejarlos fuera no rompe nada: Maven resuelve los parents del disco y del
     * repositorio local, no del workspace de Eclipse.
     */
    private isJavaCode(m: ModuleInfo): boolean {
        return m.language === 'java' && m.packaging !== 'pom';
    }

    /**
     * El puente solo existe con el servidor en modo Standard. Con
     * java.import.projectSelection en 'manual' arranca en LightWeight, y hasta
     * que no se importe algo una vez no hay con quién hablar.
     */
    private javaServerReady(channel: vscode.OutputChannel): boolean {
        const java = vscode.extensions.getExtension('redhat.java');
        if (!java) {
            vscode.window.showErrorMessage(
                'Language Support for Java (redhat.java) no está instalado.');
            return false;
        }
        const mode = java.isActive ? java.exports?.serverMode : undefined;
        channel.appendLine(`Servidor de Java: ${java.isActive ? `activo, modo ${mode ?? '?'}` : 'inactivo'}`);

        if (java.isActive && mode === 'LightWeight') {
            vscode.window.showWarningMessage(
                'El servidor de Java está en modo LightWeight y todavía no acepta cambios de ' +
                'importación. Importa cualquier proyecto una vez (basta con uno) y vuelve a lanzar esto.');
            return false;
        }
        return true;
    }

    /**
     * Lenguaje de cada módulo del reactor, en una sola llamada a Maven.
     *
     * help:effective-pom sobre el agregador devuelve el pom efectivo de todos
     * los módulos, ya con la herencia resuelta — que es donde vive
     * gjs.source.language, porque los módulos rara vez lo declaran. El
     * directorio de cada uno sale de <build><directory>, que en el pom efectivo
     * ya viene absoluto.
     */
    private async classify(rootDir: string, channel: vscode.OutputChannel): Promise<ModuleInfo[]> {
        const outputFile = path.join(rootDir, EFFECTIVE_POM);
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });

        channel.appendLine('⏳ Resolviendo el pom efectivo del reactor (una sola pasada)...');
        await this.runner.runAndWait(`help:effective-pom -Doutput="${outputFile}"`, rootDir, channel);

        if (!fs.existsSync(outputFile)) {
            throw new Error('help:effective-pom no generó salida.');
        }

        const parser = new XMLParser({
            ignoreAttributes: true,
            // Sin esto, fast-xml-parser convierte lo que parece un número: una
            // versión '1.0' acabaría siendo el número 1. Aquí todo son rutas,
            // artifactIds y nombres de lenguaje, así que mejor cadenas siempre.
            parseTagValue: false,
            // Con un solo módulo la raíz es <project> y no habría lista
            isArray: name => name === 'project'
        });
        const parsed = parser.parse(fs.readFileSync(outputFile, 'utf8'));

        // Un agregador devuelve <projects><project>...; un módulo suelto, <project>
        const projects: any[] = parsed?.projects?.project ?? parsed?.project ?? [];

        const modules: ModuleInfo[] = [];
        for (const p of projects) {
            const directory = p?.build?.directory;
            if (typeof directory !== 'string' || !directory) { continue; }

            const language = p?.properties?.['gjs.source.language'];
            modules.push({
                projectDir: path.dirname(directory),
                artifactId: String(p?.artifactId ?? ''),
                packaging:  String(p?.packaging ?? 'jar'),
                language:   typeof language === 'string' ? language.trim().toLowerCase() : undefined
            });
        }
        return modules;
    }

    /**
     * Proyectos que el servidor de Java tiene importados ahora mismo.
     *
     * El argumento no es opcional aunque lo parezca: el mismo comando devuelve
     * cosas distintas según se lo pases o no. Sin él solo llegan los proyectos
     * con naturaleza Java —que en un árbol nar son bastantes más de los que
     * tienen código Java, porque m2e se la asigna igual— y no el resto. Medido
     * en gjs: 45 sin el argumento, 119 con él.
     */
    private async importedProjects(channel: vscode.OutputChannel): Promise<string[]> {
        try {
            const uris = await vscode.commands.executeCommand<string[]>(
                JAVA_BRIDGE, JAVA_GET_ALL, JSON.stringify({ includeNonJava: true }));
            return (uris ?? [])
                .map(u => vscode.Uri.parse(u).fsPath)
                .filter(dir => path.basename(dir) !== DEFAULT_PROJECT);
        } catch (err: any) {
            // Sin esta lista no sabemos qué soltar, pero sí qué importar.
            channel.appendLine(`⚠️  No se pudo consultar lo importado (${err.message}); no se soltará nada.`);
            return [];
        }
    }

    /**
     * Las tres listas que espera changeImportedProjects, con los mismos tipos
     * que usa el flujo de redhat.java: los que entran van por su fichero de
     * construcción, los que se actualizan o se sueltan van por su directorio.
     */
    private plan(javaDirs: string[], imported: string[]) {
        const isImported = (dir: string) => imported.some(p => path.relative(p, dir) === '');
        const isJava = (dir: string) => javaDirs.some(d => path.relative(d, dir) === '');

        const toImport: string[] = [];
        const toUpdate: string[] = [];
        for (const dir of javaDirs) {
            if (isImported(dir)) {
                toUpdate.push(vscode.Uri.file(dir).toString());
            } else {
                toImport.push(vscode.Uri.file(path.join(dir, 'pom.xml')).toString());
            }
        }

        const toDelete = imported
            .filter(dir => !isJava(dir))
            .map(dir => vscode.Uri.file(dir).toString());

        return { toImport, toUpdate, toDelete };
    }

    private static _channel: vscode.OutputChannel | undefined;
    private static getOutputChannel(): vscode.OutputChannel {
        if (!ImportJavaModulesCommand._channel) {
            ImportJavaModulesCommand._channel =
                vscode.window.createOutputChannel('GJS Maven: Java Import');
        }
        return ImportJavaModulesCommand._channel;
    }
}
