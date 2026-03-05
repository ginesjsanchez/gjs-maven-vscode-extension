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
exports.PomXmlHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
const ELEMENT_DOCS = {
    groupId: '**groupId** — Identifies your project\'s group, typically the reverse domain of your organisation (e.g. `com.example`).',
    artifactId: '**artifactId** — The unique name for this artifact within the group.',
    version: '**version** — The project version. Use `-SNAPSHOT` suffix for work-in-progress builds.',
    packaging: '**packaging** — Build output type: `jar`, `war`, `ear`, `pom`, `nar`, etc.',
    scope: '**scope** — Dependency visibility:\n- `compile` (default) everywhere\n- `provided` by container\n- `runtime` only at runtime\n- `test` only in tests\n- `system` explicit path\n- `import` BOM import',
    parent: '**parent** — Inherit configuration from a parent POM (e.g. Spring Boot Starter Parent).',
    modules: '**modules** — Lists sub-modules in a multi-module (reactor) project.',
    properties: '**properties** — Key/value pairs used throughout the POM via `${key}` syntax.',
    dependencies: '**dependencies** — List of project dependencies.',
    dependency: '**dependency** — A single Maven artifact coordinate: groupId + artifactId + version.',
    dependencyManagement: '**dependencyManagement** — Centralise dependency versions; sub-modules inherit without specifying versions.',
    build: '**build** — Build configuration: source directories, plugins, resources.',
    plugins: '**plugins** — Maven plugins that extend the build lifecycle.',
    plugin: '**plugin** — A single Maven plugin definition.',
    configuration: '**configuration** — Plugin-specific configuration parameters.',
    executions: '**executions** — Bind plugin goals to specific lifecycle phases.',
    execution: '**execution** — One execution block: id, phase, goals, configuration.',
    goals: '**goals** — The plugin goals to run in this execution.',
    phase: '**phase** — The lifecycle phase at which this goal is bound.',
    profiles: '**profiles** — Conditional build configurations activated by environment or property.',
    profile: '**profile** — A single profile with its own dependencies, plugins and properties.',
    repositories: '**repositories** — Additional remote repositories to resolve artifacts from.',
    distributionManagement: '**distributionManagement** — Where to deploy snapshots and releases.',
    exclusions: '**exclusions** — Transitive dependencies to exclude.',
    optional: '**optional** — When `true`, this dependency is not inherited by downstream projects.',
    systemPath: '**systemPath** — Absolute path to a system-scoped dependency jar.',
    classifier: '**classifier** — Distinguishes artifacts with the same coordinates (e.g. `tests`, `sources`, `javadoc`, OS-native classifier for NAR).',
    type: '**type** — Artifact type: `jar` (default), `war`, `pom`, `nar`, `test-jar`, etc.',
};
const SCOPE_DETAIL = {
    compile: '🟢 **compile** — Available in all classpaths. Included in packaged artifact.',
    provided: '🔵 **provided** — Available at compile time; not packaged (JDK / container provides it).',
    runtime: '🟡 **runtime** — Not needed for compilation; required at runtime.',
    test: '🧪 **test** — Only during test compilation and execution.',
    system: '⚠️ **system** — Requires `<systemPath>`. Not resolved from repository.',
    import: '📦 **import** — Used with `<type>pom</type>` in dependencyManagement to import a BOM.',
};
class PomXmlHoverProvider {
    provideHover(document, position) {
        const wordRange = document.getWordRangeAtPosition(position, /[\w.:-]+/);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        const lineText = document.lineAt(position).text.trim();
        // Scope value hover
        if (lineText.startsWith('<scope>') && SCOPE_DETAIL[word]) {
            return new vscode.Hover(new vscode.MarkdownString(SCOPE_DETAIL[word]));
        }
        // Element name hover (cursor on the tag name inside < >)
        if (ELEMENT_DOCS[word]) {
            return new vscode.Hover(new vscode.MarkdownString(ELEMENT_DOCS[word]));
        }
        // Property expression ${...}
        const propMatch = lineText.match(/\$\{([\w.]+)\}/);
        if (propMatch) {
            return new vscode.Hover(new vscode.MarkdownString(`**\`${propMatch[0]}\`** — Maven property reference. Resolved from \`<properties>\`, system properties, or environment variables.`));
        }
        return undefined;
    }
}
exports.PomXmlHoverProvider = PomXmlHoverProvider;
//# sourceMappingURL=PomXmlHoverProvider.js.map