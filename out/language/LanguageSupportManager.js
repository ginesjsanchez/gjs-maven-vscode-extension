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
const fs = __importStar(require("fs"));
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
        await this.detectAndSuggest();
        // Re-check when pom.xml changes (new languages might be configured via plugins)
        const watcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
        watcher.onDidChange(() => this.detectAndSuggest());
        this.context.subscriptions.push(watcher);
    }
    async detectAndSuggest() {
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
    async detectLanguages(pomPath) {
        const detected = [];
        const text = fs.readFileSync(pomPath, 'utf8');
        //  Language detection from pom.xml content 
        if (text.includes('maven-compiler-plugin') ||
            text.includes('<groupId>org.springframework') ||
            /\.(java)/.test(await this.findSourceFiles('**/*.java'))) {
            detected.push('java');
        }
        if (text.includes('nar-maven-plugin') ||
            text.includes('cmake-maven') ||
            /\.(cpp|cxx|cc|c|h|hpp)/.test(await this.findSourceFiles('**/*.{cpp,c,h,hpp}'))) {
            detected.push('cpp');
        }
        if (text.includes('jython') ||
            text.includes('exec-maven-plugin') ||
            /\.py/.test(await this.findSourceFiles('**/*.py'))) {
            detected.push('python');
        }
        if (text.includes('kotlin') || /\.kt/.test(await this.findSourceFiles('**/*.kt'))) {
            detected.push('kotlin');
        }
        if (text.includes('scala') || /\.scala/.test(await this.findSourceFiles('**/*.scala'))) {
            detected.push('scala');
        }
        return detected;
    }
    async findSourceFiles(pattern) {
        const files = await vscode.workspace.findFiles(pattern, '**/target/**', 1);
        return files.map(f => f.fsPath).join(',');
    }
    suggestExtensions(languages) {
        const suggestions = [];
        if (languages.includes('java')) {
            suggestions.push({
                lang: 'Java',
                extensions: ['Language Support for Java (Red Hat)', 'Debugger for Java'],
                ids: ['redhat.java', 'vscjava.vscode-java-debug']
            });
        }
        if (languages.includes('cpp')) {
            suggestions.push({
                lang: 'C/C++',
                extensions: ['C/C++ (Microsoft)', 'CMake Tools'],
                ids: ['ms-vscode.cpptools', 'ms-vscode.cmake-tools']
            });
        }
        if (languages.includes('python')) {
            suggestions.push({
                lang: 'Python',
                extensions: ['Python (Microsoft)', 'Pylance'],
                ids: ['ms-python.python', 'ms-python.vscode-pylance']
            });
        }
        if (languages.includes('kotlin')) {
            suggestions.push({
                lang: 'Kotlin',
                extensions: ['Kotlin Language (fwcd)'],
                ids: ['fwcd.kotlin']
            });
        }
        if (languages.includes('scala')) {
            suggestions.push({
                lang: 'Scala',
                extensions: ['Metals (Scala)'],
                ids: ['scalameta.metals']
            });
        }
        if (suggestions.length === 0) {
            return;
        }
        // Check which recommended extensions are not already installed
        const missing = suggestions
            .flatMap(s => s.ids.map(id => ({ id, lang: s.lang, name: s.extensions[s.ids.indexOf(id)] })))
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
            const notInstalled = s.ids.filter(id => missing.find(m => m.id === id));
            const status = notInstalled.length === 0 ? '✔ All installed' : `⚠ Missing: ${notInstalled.join(', ')}`;
            return `**${s.lang}**: ${s.extensions.join(', ')}\n${status}`;
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