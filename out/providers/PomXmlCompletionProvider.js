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
exports.PomXmlCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
// ── Completion data ────────────────────────────────────────────────────────────
const LIFECYCLE_PHASES = [
    'validate', 'initialize', 'generate-sources', 'process-sources', 'generate-resources',
    'process-resources', 'compile', 'process-classes', 'generate-test-sources',
    'process-test-sources', 'generate-test-resources', 'process-test-resources',
    'test-compile', 'process-test-classes', 'test', 'prepare-package', 'package',
    'pre-integration-test', 'integration-test', 'post-integration-test', 'verify',
    'install', 'deploy'
];
const PACKAGING_TYPES = ['jar', 'war', 'ear', 'pom', 'nar', 'bundle', 'maven-plugin', 'ejb'];
const SCOPES = ['compile', 'provided', 'runtime', 'test', 'system', 'import'];
const COMMON_PROPERTIES = {
    'java.version': '17',
    'maven.compiler.source': '17',
    'maven.compiler.target': '17',
    'project.build.sourceEncoding': 'UTF-8',
    'project.reporting.outputEncoding': 'UTF-8',
    'maven.compiler.release': '17',
};
const WELL_KNOWN_PLUGINS = [
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-compiler-plugin', version: '3.12.1' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-surefire-plugin', version: '3.2.3' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-jar-plugin', version: '3.3.0' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-war-plugin', version: '3.4.0' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-assembly-plugin', version: '3.6.0' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-shade-plugin', version: '3.5.1' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-resources-plugin', version: '3.3.1' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-clean-plugin', version: '3.3.2' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-install-plugin', version: '3.1.1' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-deploy-plugin', version: '3.1.1' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-site-plugin', version: '4.0.0-M13' },
    { groupId: 'org.apache.maven.plugins', artifactId: 'maven-dependency-plugin', version: '3.6.1' },
    { groupId: 'com.github.maven-nar', artifactId: 'nar-maven-plugin', version: '3.10.1' },
    { groupId: 'org.springframework.boot', artifactId: 'spring-boot-maven-plugin', version: '3.2.1' },
    { groupId: 'org.graalvm.buildtools', artifactId: 'native-maven-plugin', version: '0.10.0' },
];
// ── Provider ───────────────────────────────────────────────────────────────────
class PomXmlCompletionProvider {
    provideCompletionItems(document, position) {
        const lineText = document.lineAt(position).text;
        const textBefore = lineText.substring(0, position.character);
        const context = this.getXmlContext(document, position);
        // ── <scope> ──────────────────────────────────────────────────────────
        if (this.isInsideTag(textBefore, 'scope')) {
            return SCOPES.map(s => {
                const item = new vscode.CompletionItem(s, vscode.CompletionItemKind.EnumMember);
                item.detail = `Maven scope: ${s}`;
                item.documentation = this.scopeDoc(s);
                return item;
            });
        }
        // ── <packaging> ──────────────────────────────────────────────────────
        if (this.isInsideTag(textBefore, 'packaging')) {
            return PACKAGING_TYPES.map(p => {
                const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.EnumMember);
                item.detail = `Packaging type: ${p}`;
                return item;
            });
        }
        // ── <phase> ─────────────────────────────────────────────────────────
        if (this.isInsideTag(textBefore, 'phase')) {
            return LIFECYCLE_PHASES.map(ph => {
                const item = new vscode.CompletionItem(ph, vscode.CompletionItemKind.EnumMember);
                item.detail = 'Maven lifecycle phase';
                return item;
            });
        }
        // ── Inside <properties> ─────────────────────────────────────────────
        if (context.includes('properties')) {
            return this.getPropertyCompletions();
        }
        // ── Inside <plugins> ────────────────────────────────────────────────
        if (context.includes('plugin')) {
            return this.getPluginCompletions(document, position, textBefore);
        }
        // ── Top-level element completions ────────────────────────────────────
        if (this.isTagOpening(textBefore)) {
            return this.getTopLevelCompletions();
        }
        return [];
    }
    // ── Helpers ──────────────────────────────────────────────────────────────
    getPropertyCompletions() {
        return Object.entries(COMMON_PROPERTIES).map(([key, val]) => {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property);
            item.insertText = new vscode.SnippetString(`${key}>${val}</${key}>`);
            item.detail = `Default: ${val}`;
            return item;
        });
    }
    getPluginCompletions(_doc, _pos, textBefore) {
        if (this.isInsideTag(textBefore, 'artifactId')) {
            return WELL_KNOWN_PLUGINS.map(p => {
                const item = new vscode.CompletionItem(p.artifactId, vscode.CompletionItemKind.Module);
                item.detail = `${p.groupId} — ${p.version}`;
                return item;
            });
        }
        if (this.isInsideTag(textBefore, 'groupId')) {
            const groups = [...new Set(WELL_KNOWN_PLUGINS.map(p => p.groupId))];
            return groups.map(g => new vscode.CompletionItem(g, vscode.CompletionItemKind.Module));
        }
        if (this.isInsideTag(textBefore, 'version')) {
            // Can't know current plugin; return latest versions
            return WELL_KNOWN_PLUGINS.map(p => {
                const item = new vscode.CompletionItem(p.version, vscode.CompletionItemKind.Constant);
                item.detail = p.artifactId;
                return item;
            });
        }
        return [];
    }
    getTopLevelCompletions() {
        const tags = [
            ['groupId', 'com.example'],
            ['artifactId', 'my-project'],
            ['version', '1.0.0-SNAPSHOT'],
            ['packaging', 'jar'],
            ['name', 'My Project'],
            ['description', 'Project description'],
            ['properties', ''],
            ['dependencies', ''],
            ['build', ''],
            ['profiles', ''],
            ['modules', ''],
            ['parent', ''],
            ['dependencyManagement', ''],
            ['pluginManagement', ''],
            ['repositories', ''],
            ['distributionManagement', ''],
        ];
        return tags.map(([tag, def]) => {
            const item = new vscode.CompletionItem(`<${tag}>`, vscode.CompletionItemKind.Property);
            item.insertText = new vscode.SnippetString(def ? `${tag}>\${1:${def}}</${tag}>` : `${tag}>\n    \$0\n</${tag}>`);
            return item;
        });
    }
    isInsideTag(text, tagName) {
        const re = new RegExp(`<${tagName}[^>]*>[^<]*$`);
        return re.test(text);
    }
    isTagOpening(text) {
        return text.trimEnd().endsWith('<');
    }
    getXmlContext(document, position) {
        const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const tags = [];
        const re = /<\/?(\w[\w.-]*)[^>]*>/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            if (m[0].startsWith('</')) {
                tags.pop();
            }
            else if (!m[0].endsWith('/>')) {
                tags.push(m[1]);
            }
        }
        return tags.join('/');
    }
    scopeDoc(scope) {
        const docs = {
            compile: 'Default. Available everywhere.',
            provided: 'Like compile but not packaged; provided by JDK or container.',
            runtime: 'Not needed for compilation, needed at runtime.',
            test: 'Only for test compilation and execution.',
            system: 'Like provided but must supply explicit path via <systemPath>.',
            import: 'Only for <type>pom</type> in dependencyManagement.',
        };
        return docs[scope] ?? scope;
    }
}
exports.PomXmlCompletionProvider = PomXmlCompletionProvider;
//# sourceMappingURL=PomXmlCompletionProvider.js.map