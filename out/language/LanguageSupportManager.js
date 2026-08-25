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
exports.LanguageSupportManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const MavenProjectContext_1 = require("../context/MavenProjectContext");
const LANGUAGE_SUPPORT = [
    {
        languages: ['java'],
        label: 'Java',
        extensions: [
            { id: 'redhat.java', name: 'Language Support for Java (Red Hat)' },
            { id: 'vscjava.vscode-java-debug', name: 'Debugger for Java' }
        ]
    },
    {
        languages: ['c', 'c++'],
        label: 'C/C++',
        extensions: [
            { id: 'ms-vscode.cpptools', name: 'C/C++ (Microsoft)' },
            { id: 'ms-vscode.cmake-tools', name: 'CMake Tools' }
        ]
    },
    {
        languages: ['python'],
        label: 'Python',
        extensions: [
            { id: 'ms-python.python', name: 'Python (Microsoft)' },
            { id: 'ms-python.vscode-pylance', name: 'Pylance' }
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
class LanguageSupportManager {
    constructor(context) {
        this.context = context;
        this.statusShown = false;
    }
    async activate() {
        // Sin await: la detección puede acabar preguntando a Maven, y eso
        // tardaría segundos en los que la extensión no debe quedarse parada.
        void this.detectAndSuggest();
        // Re-check when pom.xml changes (new languages might be configured via plugins)
        const watcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
        watcher.onDidChange(() => this.detectAndSuggest());
        this.context.subscriptions.push(watcher);
        // El lenguaje del pom activo puede llegar tarde, cuando Maven resuelve
        // la herencia; en ese momento hay una oportunidad más de acertar.
        this.context.subscriptions.push(MavenProjectContext_1.MavenProjectContext.onDidChange(info => {
            if (info?.language) {
                this.detectAndSuggest();
            }
        }));
    }
    async detectAndSuggest() {
        if (this.statusShown) {
            return;
        }
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**', 5);
        if (poms.length === 0) {
            return;
        }
        const languages = await this.detectLanguages(poms[0].fsPath);
        if (!this.statusShown && languages.length > 0) {
            this.statusShown = true;
            this.suggestExtensions(languages);
        }
    }
    /** Devuelve valores canónicos de gjs.source.language. */
    async detectLanguages(pomPath) {
        const detected = new Set();
        // Lo que el propio proyecto declara, que manda sobre cualquier indicio
        const active = MavenProjectContext_1.MavenProjectContext.current?.language;
        if (active) {
            detected.add(active);
        }
        const declared = await MavenProjectContext_1.MavenProjectContext.getLanguage(path.dirname(pomPath));
        if (declared) {
            detected.add(declared);
        }
        // Proyectos Maven ajenos a gjs, que no declaran la propiedad
        if (detected.size === 0) {
            for (const language of await this.detectFromEvidence(pomPath)) {
                detected.add(language);
            }
        }
        return [...detected];
    }
    /** Heurística de respaldo: plugins del pom y ficheros fuente del workspace. */
    async detectFromEvidence(pomPath) {
        const detected = [];
        const text = fs.readFileSync(pomPath, 'utf8');
        if (text.includes('maven-compiler-plugin') ||
            text.includes('<groupId>org.springframework') ||
            await this.hasSourceFiles('**/*.java')) {
            detected.push('java');
        }
        // Preferir la evidencia de los ficheros: el plugin nativo no distingue
        // C de C++, y ambos comparten las mismas extensiones recomendadas.
        const nativePlugin = text.includes('nar-maven-plugin') || text.includes('cmake-maven');
        if (await this.hasSourceFiles('**/*.{cpp,cxx,cc,hpp}')) {
            detected.push('c++');
        }
        else if (nativePlugin || await this.hasSourceFiles('**/*.{c,h}')) {
            detected.push('c');
        }
        if (text.includes('jython') ||
            text.includes('exec-maven-plugin') ||
            await this.hasSourceFiles('**/*.py')) {
            detected.push('python');
        }
        if (text.includes('frontend-maven-plugin') ||
            await this.hasSourceFiles('**/*.ts')) {
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
    async hasSourceFiles(pattern) {
        const files = await vscode.workspace.findFiles(pattern, '{**/target/**,**/node_modules/**}', 1);
        return files.length > 0;
    }
    suggestExtensions(languages) {
        const suggestions = LANGUAGE_SUPPORT.filter(s => s.languages.some(l => languages.includes(l)));
        if (suggestions.length === 0) {
            return;
        }
        // Check which recommended extensions are not already installed
        const missing = suggestions
            .flatMap(s => s.extensions.map(e => ({ id: e.id, lang: s.label, name: e.name })))
            .filter(e => !vscode.extensions.getExtension(e.id));
        if (missing.length === 0) {
            return;
        }
        const langList = [...new Set(missing.map(e => e.lang))].join(', ');
        const message = `Gjs Maven VS Code Extension detected ${langList} code in this project.`;
        vscode.window.showInformationMessage(message, 'Install Recommended Extensions', 'Show Details', 'Dismiss').then(choice => {
            if (choice === 'Install Recommended Extensions') {
                this.installExtensions(missing.map(e => e.id));
            }
            else if (choice === 'Show Details') {
                this.showLanguageDetails(suggestions, missing);
            }
        });
    }
    installExtensions(ids) {
        // Open Extensions view with each ID
        for (const id of ids) {
            vscode.commands.executeCommand('workbench.extensions.installExtension', id);
        }
    }
    showLanguageDetails(suggestions, missing) {
        const lines = suggestions.map(s => {
            const notInstalled = s.extensions.filter(e => missing.find(m => m.id === e.id));
            const status = notInstalled.length === 0
                ? '✔ All installed'
                : `⚠ Missing: ${notInstalled.map(e => e.id).join(', ')}`;
            return `**${s.label}**: ${s.extensions.map(e => e.name).join(', ')}\n${status}`;
        });
        const panel = vscode.window.createWebviewPanel('mavenLangSupport', 'Gjs Maven VS Code Extension — Language Support', vscode.ViewColumn.Active, {});
        panel.webview.html = this.buildHtml(lines);
    }
    buildHtml(lines) {
        const items = lines.map(l => `<li>${l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</li>`).join('');
        return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);padding:20px">
<h2>🔧 Language Support Recommendations</h2>
<ul>${items}</ul>
<p>Gjs Maven VS Code Extension handles pom.xml editing and Maven commands for <em>any</em> language.
The extensions above add code editing features (IntelliSense, debugging) for each language.</p>
</body></html>`;
    }
}
exports.LanguageSupportManager = LanguageSupportManager;
//# sourceMappingURL=LanguageSupportManager.js.map