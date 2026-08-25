import * as vscode from 'vscode';
import { MavenModuleInfo, MavenProjectInfo } from '../context/MavenProjectContext';

/**
 * Elemento de la barra de estado: en qué módulo estás y con qué perfiles.
 *
 * Antes ponía siempre "Maven", aunque los métodos ya recibían el artifactId y
 * lo descartaban. Y se alimentaba del pom activo, que solo existe cuando el
 * editor tiene abierto un pom.xml: al pasar a un fichero fuente el nombre se
 * perdía. Ahora manda el módulo activo, que es el concepto que sí acompaña a
 * cualquier fichero, y el pom solo aporta el icono y el color cuando lo estás
 * mirando.
 *
 * Guarda el estado y repinta, en vez de que cada llamada componga el texto:
 * los tres datos —módulo, pom y perfiles— llegan por vías distintas y en
 * cualquier orden.
 */
export class MavenStatusBar implements vscode.Disposable {
    private item: vscode.StatusBarItem;

    private profiles: string[] = [];
    private module: MavenModuleInfo | undefined;
    private pom: MavenProjectInfo | undefined;
    /** Goal en curso; mientras hay uno, manda sobre lo demás. */
    private running: string | undefined;
    private failed: string | undefined;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.item.command = 'gjs-maven-vscode-extension.manageProfiles';
        this.item.hide();
    }

    /** Módulo al que pertenece el fichero que se edita, sea del tipo que sea. */
    setModule(module: MavenModuleInfo | undefined, profiles?: string[]): void {
        this.module = module;
        if (profiles) { this.profiles = profiles; }
        this.render();
    }

    /** Pom que se está mirando; undefined si el editor no tiene uno abierto. */
    setPom(pom: MavenProjectInfo | undefined, profiles?: string[]): void {
        this.pom = pom;
        if (profiles) { this.profiles = profiles; }
        this.render();
    }

    setReady(profiles: string[] = this.profiles): void {
        this.profiles = profiles;
        this.running = undefined;
        this.failed = undefined;
        this.render();
    }

    setRunning(goal: string, profiles: string[] = this.profiles): void {
        this.profiles = profiles;
        this.running = goal;
        this.failed = undefined;
        this.render();
    }

    setError(goal: string): void {
        this.running = undefined;
        this.failed = goal;
        this.render();
    }

    private render(): void {
        if (!vscode.workspace.getConfiguration('gjsMaven').get<boolean>('showStatusBar', true)) {
            this.item.hide();
            return;
        }

        const profilesText = this.profiles.length > 0 ? this.profiles.join(', ') : '<default>';
        const profileLabel = ` [${profilesText}]`;

        this.item.color = undefined;
        this.item.backgroundColor = undefined;

        if (this.failed) {
            this.item.text = `$(error) mvn ${this.failed} failed`;
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.item.tooltip = `Last run failed: mvn ${this.failed}`;
            this.item.show();
            return;
        }

        if (this.running) {
            this.item.text = `$(loading~spin) mvn ${this.running}${profileLabel}`;
            this.item.tooltip = `Running: mvn ${this.running}`;
            this.item.show();
            return;
        }

        const kind = this.kind();
        // Sin módulo activo no hay nombre que poner, y 'Maven' sigue siendo
        // mejor que dejar el elemento vacío o esconderlo
        const name = this.module?.artifactId ?? 'Maven';

        this.item.text = `${kind.icon} ${name}${profileLabel}`;
        this.item.color = kind.color;
        this.item.tooltip = this.buildTooltip(kind.label, profilesText);
        this.item.show();
    }

    /**
     * El icono y el color describen QUÉ es el pom que estás mirando. Con un
     * fichero fuente delante no hay pom que describir, así que se cae al icono
     * neutro sin perder el nombre del módulo.
     */
    private kind(): { icon: string; color?: string; label: string } {
        const pom = this.pom;
        if (!pom) { return { icon: '$(package)', label: 'Module' }; }

        if (pom.packaging === 'pom' && pom.hasModules) {
            return { icon: '$(folder-library)', color: 'yellow', label: 'Aggregator POM' };
        }
        if (pom.packaging === 'pom') {
            return { icon: '$(type-hierarchy)', color: 'green', label: 'Parent POM' };
        }
        if (pom.packaging === 'maven-archetype') {
            return { icon: '$(symbol-structure)', color: 'red', label: 'Archetype' };
        }
        return { icon: '$(package)', label: 'Module' };
    }

    private buildTooltip(label: string, profilesText: string): vscode.MarkdownString {
        const lines: string[] = [];

        if (this.module) {
            const coordinates = this.pom
                ? `${this.pom.groupId}:${this.pom.artifactId}:${this.pom.version}`
                : this.module.artifactId ?? '';
            lines.push(`**${label}** — ${coordinates}`);
            if (this.module.language) { lines.push(`- language: \`${this.module.language}\``); }
            lines.push(`- \`${this.module.projectDir}\``);
        } else {
            lines.push('**Maven** — no active module');
        }

        lines.push('', `Active profiles: ${profilesText}`);
        return new vscode.MarkdownString(lines.join('\n'));
    }

    dispose(): void {
        this.item.dispose();
    }
}
