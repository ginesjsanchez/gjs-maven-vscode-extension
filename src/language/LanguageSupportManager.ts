import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MavenProjectContext } from '../context/MavenProjectContext';

/**
 * Extensiones recomendadas para cada lenguaje. Las claves son los valores
 * canónicos de la propiedad gjs.source.language ('c', 'c++', 'java',
 * 'python', 'typescript'...), el mismo vocabulario que publica
 * MavenProjectContext, no uno propio.
 */
interface LanguageSupport {
    languages: string[];
    label: string;
    extensions: { id: string; name: string }[];
}

const LANGUAGE_SUPPORT: LanguageSupport[] = [
    {
        languages: ['java'],
        label: 'Java',
        extensions: [
            { id: 'redhat.java',                name: 'Language Support for Java (Red Hat)' },
            { id: 'vscjava.vscode-java-debug',  name: 'Debugger for Java' }
        ]
    },
    {
        languages: ['c', 'c++'],
        label: 'C/C++',
        extensions: [
            { id: 'ms-vscode.cpptools',     name: 'C/C++ (Microsoft)' },
            { id: 'ms-vscode.cmake-tools',  name: 'CMake Tools' }
        ]
    },
    {
        languages: ['python'],
        label: 'Python',
        extensions: [
            { id: 'ms-python.python',           name: 'Python (Microsoft)' },
            { id: 'ms-python.vscode-pylance',   name: 'Pylance' }
        ]
    },
    {
        languages: ['typescript', 'javascript'],
        label: 'TypeScript/JavaScript',
        extensions: [
            { id: 'dbaeumer.vscode-eslint', name: 'ESLint' }
        ]
    },
    {
        languages: ['kotlin'],
        label: 'Kotlin',
        extensions: [
            { id: 'fwcd.kotlin', name: 'Kotlin Language (fwcd)' }
        ]
    },
    {
        languages: ['scala'],
        label: 'Scala',
        extensions: [
            { id: 'scalameta.metals', name: 'Metals (Scala)' }
        ]
    }
];

/**
 * Detects which languages are used in the Maven project and
 * gives helpful recommendations / hints about recommended extensions.
 */
export class LanguageSupportManager {
    private statusShown = false;

    constructor(private context: vscode.ExtensionContext) {}

    async activate(): Promise<void> {
        // Sin await: la detección puede acabar preguntando a Maven, y eso
        // tardaría segundos en los que la extensión no debe quedarse parada.
        void this.detectAndSuggest();

        // Re-check when pom.xml changes (new languages might be configured via plugins)
        const watcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
        watcher.onDidChange(() => this.detectAndSuggest());
        this.context.subscriptions.push(watcher);

        // El lenguaje del pom activo puede llegar tarde, cuando Maven resuelve
        // la herencia; en ese momento hay una oportunidad más de acertar.
        this.context.subscriptions.push(
            MavenProjectContext.onDidChange(info => {
                if (info?.language) { this.detectAndSuggest(); }
            })
        );
    }

    private async detectAndSuggest(): Promise<void> {
        if (this.statusShown) { return; }

        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 5);
        if (poms.length === 0) { return; }

        const languages = await this.detectLanguages(poms[0].fsPath);

        if (!this.statusShown && languages.length > 0) {
            this.statusShown = true;
            this.suggestExtensions(languages);
        }
    }

    /** Devuelve valores canónicos de gjs.source.language. */
    private async detectLanguages(pomPath: string): Promise<string[]> {
        const detected = new Set<string>();

        // Lo que el propio proyecto declara, que manda sobre cualquier indicio
        const active = MavenProjectContext.current?.language;
        if (active) { detected.add(active); }

        const declared = await MavenProjectContext.getLanguage(path.dirname(pomPath));
        if (declared) { detected.add(declared); }

        // Proyectos Maven ajenos a gjs, que no declaran la propiedad
        if (detected.size === 0) {
            for (const language of await this.detectFromEvidence(pomPath)) {
                detected.add(language);
            }
        }

        return [...detected];
    }

    /** Heurística de respaldo: plugins del pom y ficheros fuente del workspace. */
    private async detectFromEvidence(pomPath: string): Promise<string[]> {
        const detected: string[] = [];
        const text = fs.readFileSync(pomPath, 'utf8');

        if (
            text.includes('maven-compiler-plugin') ||
            text.includes('<groupId>org.springframework') ||
            await this.hasSourceFiles('**/*.java')
        ) {
            detected.push('java');
        }

        // Preferir la evidencia de los ficheros: el plugin nativo no distingue
        // C de C++, y ambos comparten las mismas extensiones recomendadas.
        const nativePlugin = text.includes('nar-maven-plugin') || text.includes('cmake-maven');
        if (await this.hasSourceFiles('**/*.{cpp,cxx,cc,hpp}')) {
            detected.push('c++');
        } else if (nativePlugin || await this.hasSourceFiles('**/*.{c,h}')) {
            detected.push('c');
        }

        if (
            text.includes('jython') ||
            text.includes('exec-maven-plugin') ||
            await this.hasSourceFiles('**/*.py')
        ) {
            detected.push('python');
        }

        if (
            text.includes('frontend-maven-plugin') ||
            await this.hasSourceFiles('**/*.ts')
        ) {
            detected.push('typescript');
        }

        if (text.includes('kotlin') || await this.hasSourceFiles('**/*.kt')) {
            detected.push('kotlin');
        }

        if (text.includes('scala') || await this.hasSourceFiles('**/*.scala')) {
            detected.push('scala');
        }

        return detected;
    }

    private async hasSourceFiles(pattern: string): Promise<boolean> {
        const files = await vscode.workspace.findFiles(pattern, '{**/target/**,**/node_modules/**}', 1);
        return files.length > 0;
    }

    private suggestExtensions(languages: string[]): void {
        const suggestions = LANGUAGE_SUPPORT.filter(
            s => s.languages.some(l => languages.includes(l))
        );
        if (suggestions.length === 0) { return; }

        // Check which recommended extensions are not already installed
        const missing = suggestions
            .flatMap(s => s.extensions.map(e => ({ id: e.id, lang: s.label, name: e.name })))
            .filter(e => !vscode.extensions.getExtension(e.id));

        if (missing.length === 0) { return; }

        const langList = [...new Set(missing.map(e => e.lang))].join(', ');
        const message = `Gjs Maven VS Code Extension detected ${langList} code in this project.`;

        vscode.window.showInformationMessage(
            message,
            'Install Recommended Extensions',
            'Show Details',
            'Dismiss'
        ).then(choice => {
            if (choice === 'Install Recommended Extensions') {
                this.installExtensions(missing.map(e => e.id));
            } else if (choice === 'Show Details') {
                this.showLanguageDetails(suggestions, missing);
            }
        });
    }

    private installExtensions(ids: string[]): void {
        // Open Extensions view with each ID
        for (const id of ids) {
            vscode.commands.executeCommand('workbench.extensions.installExtension', id);
        }
    }

    private showLanguageDetails(
        suggestions: LanguageSupport[],
        missing: { id: string; lang: string; name: string }[]
    ): void {
        const lines = suggestions.map(s => {
            const notInstalled = s.extensions.filter(e => missing.find(m => m.id === e.id));
            const status = notInstalled.length === 0
                ? '✔ All installed'
                : `⚠ Missing: ${notInstalled.map(e => e.id).join(', ')}`;
            return `**${s.label}**: ${s.extensions.map(e => e.name).join(', ')}\n${status}`;
        });

        const panel = vscode.window.createWebviewPanel(
            'mavenLangSupport',
            'Gjs Maven VS Code Extension — Language Support',
            vscode.ViewColumn.Active,
            {}
        );
        panel.webview.html = this.buildHtml(lines);
    }

    private buildHtml(lines: string[]): string {
        const items = lines.map(l => `<li>${l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</li>`).join('');
        return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);padding:20px">
<h2>🔧 Language Support Recommendations</h2>
<ul>${items}</ul>
<p>Gjs Maven VS Code Extension handles pom.xml editing and Maven commands for <em>any</em> language.
The extensions above add code editing features (IntelliSense, debugging) for each language.</p>
</body></html>`;
    }
}
