import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MavenProjectContext, MavenModuleInfo } from '../context/MavenProjectContext';
import { MavenUpdateCommand } from '../commands/MavenUpdateCommand';

/** Lo que publica nar-include-path, relativo al directorio del módulo. */
const GENERATED_RELATIVE = path.join('target', 'nar', 'c_cpp_properties.json');
/** Lo que lee la extensión de C/C++, relativo a la carpeta del workspace. */
const INSTALLED_RELATIVE = path.join('.vscode', 'c_cpp_properties.json');

const CPP_LANGUAGES = ['c', 'c++'];
/** Margen para que moverse rápido entre ficheros no dispare una escritura por salto. */
const SWITCH_DELAY_MS = 250;
const OVERWRITE_APPROVED = 'gjsMaven.cppProperties.overwriteApproved';

/**
 * Mantiene .vscode/c_cpp_properties.json apuntando al módulo en el que se está
 * trabajando, en proyectos multimódulo C/C++.
 *
 * La extensión no calcula includes: los toma tal cual del fichero que publica
 * el goal nar-include-path del nar-maven-plugin, que es quien conoce los
 * defines y el estándar del modo de compilación en curso.
 */
export class CppPropertiesManager {
    private timer: NodeJS.Timeout | undefined;
    /** Módulos por los que ya se ha preguntado, para no insistir a cada salto. */
    private notified = new Set<string>();

    constructor(
        private context: vscode.ExtensionContext,
        private mavenUpdate: MavenUpdateCommand
    ) {}

    activate(): void {
        this.context.subscriptions.push(
            MavenProjectContext.onDidChangeActiveModule(module => this.schedule(module))
        );

        // Cualquier vía que regenere el fichero pasa por aquí: mvn lanzado desde
        // la extensión, desde una consola Cygwin o desde donde sea. Vigilar el
        // fichero evita tener que enumerar qué comandos lo tocan.
        const watcher = vscode.workspace.createFileSystemWatcher(`**/${GENERATED_RELATIVE.replace(/\\/g, '/')}`);
        watcher.onDidCreate(uri => this.onGenerated(uri));
        watcher.onDidChange(uri => this.onGenerated(uri));
        this.context.subscriptions.push(watcher);

        this.schedule(MavenProjectContext.activeModule);
    }

    /** Regenerar es exactamente lo que hace Maven Update en un módulo C/C++. */
    private async regenerate(module: MavenModuleInfo): Promise<void> {
        await this.mavenUpdate.execute(vscode.Uri.file(module.pomPath));
    }

    private schedule(module: MavenModuleInfo | undefined): void {
        if (this.timer) { clearTimeout(this.timer); }
        this.timer = setTimeout(() => this.apply(module), SWITCH_DELAY_MS);
    }

    private onGenerated(uri: vscode.Uri): void {
        // <modulo>/target/nar/c_cpp_properties.json
        const projectDir = path.dirname(path.dirname(path.dirname(uri.fsPath)));
        if (projectDir !== MavenProjectContext.activeModule?.projectDir) { return; }
        this.notified.delete(projectDir);
        this.schedule(MavenProjectContext.activeModule);
    }

    private async apply(module: MavenModuleInfo | undefined): Promise<void> {
        // Los módulos que no son C/C++ dejan la configuración como esté: al
        // editar un pom o una clase Java no hay por qué romper IntelliSense.
        if (!module || !CPP_LANGUAGES.includes(module.language ?? '')) { return; }

        const generated = path.join(module.projectDir, GENERATED_RELATIVE);
        if (!fs.existsSync(generated)) {
            await this.offerRegenerate(module);
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(module.projectDir));
        if (!folder) { return; }
        const installed = path.join(folder.uri.fsPath, INSTALLED_RELATIVE);

        try {
            const contents = fs.readFileSync(generated, 'utf8');

            // Reescribir sin necesidad le cuesta a IntelliSense un reanálisis
            if (fs.existsSync(installed) && fs.readFileSync(installed, 'utf8') === contents) { return; }
            if (!await this.confirmOverwrite(installed)) { return; }

            fs.mkdirSync(path.dirname(installed), { recursive: true });
            fs.writeFileSync(installed, contents, 'utf8');
            console.log(`Gjs Maven VS Code Extension: c_cpp_properties.json <- ${module.projectDir}`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`No se pudo actualizar c_cpp_properties.json: ${err.message}`);
        }
    }

    /**
     * El fichero es del usuario. Si ya había uno antes de que la extensión
     * empezara a gestionarlo, se pide permiso una vez por workspace.
     */
    private async confirmOverwrite(installed: string): Promise<boolean> {
        if (this.context.workspaceState.get<boolean>(OVERWRITE_APPROVED)) { return true; }

        if (fs.existsSync(installed)) {
            const choice = await vscode.window.showWarningMessage(
                'Ya existe .vscode/c_cpp_properties.json. Gjs Maven pasará a sobrescribirlo con la ' +
                'configuración del módulo activo cada vez que cambies de módulo.',
                'Sobrescribir', 'Dejarlo como está'
            );
            if (choice !== 'Sobrescribir') { return false; }
        }

        await this.context.workspaceState.update(OVERWRITE_APPROVED, true);
        return true;
    }

    private async offerRegenerate(module: MavenModuleInfo): Promise<void> {
        if (this.notified.has(module.projectDir)) { return; }
        this.notified.add(module.projectDir);

        const name = path.basename(module.projectDir);
        const choice = await vscode.window.showWarningMessage(
            `El módulo '${name}' no tiene calculado el includePath de C/C++. ` +
            'Maven Update lo genera sin compilar, refrescando antes sus librerías.',
            'Maven Update', 'Ahora no'
        );
        if (choice === 'Maven Update') { await this.regenerate(module); }
    }
}
