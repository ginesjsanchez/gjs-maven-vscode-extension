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
exports.MavenProjectContext = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MavenProjectContext {
    static get current() {
        return MavenProjectContext._current;
    }
    static get globalConfig() {
        return MavenProjectContext._globalConfig;
    }
    static activate(context) {
        // Update when active editor changes
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            MavenProjectContext.updateFromEditor(editor);
        }));
        // Update when active pom.xml is saved
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.fileName.endsWith('pom.xml')) {
                MavenProjectContext.updateFromDocument(doc.uri.fsPath);
            }
        }));
        // Init with current editor
        MavenProjectContext.updateFromEditor(vscode.window.activeTextEditor);
        // Load global Maven config asynchronously at startup
        // Se retarda y se llama desde extension.ts
        // MavenProjectContext.loadGlobalConfig();
    }
    static async loadGlobalConfig(evaluator, onLoaded) {
        const poms = await vscode.workspace.findFiles('pom.xml', null, 1);
        if (poms.length === 0) {
            return;
        }
        const projectDir = path.dirname(poms[0].fsPath);
        MavenProjectContext.loadLocalRepository(projectDir, evaluator);
        if (MavenProjectContext._globalConfig.localRepository) {
            onLoaded?.();
        }
    }
    static async loadLocalRepository(projectDir, evaluator) {
        // Dynamic import to avoid circular dependencies
        const localRepository = await evaluator.evaluate('settings.localRepository', projectDir);
        if (localRepository) {
            MavenProjectContext._globalConfig = { localRepository };
            vscode.commands.executeCommand('setContext', 'gjsMaven.localRepository', localRepository);
            console.log(`Gjs Maven VS Code Extension: localRepository = ${localRepository}`);
        }
    }
    static updateFromEditor(editor) {
        if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
            MavenProjectContext._current = undefined;
            vscode.commands.executeCommand('setContext', 'gjsMaven.isPom', false);
            vscode.commands.executeCommand('setContext', 'gjsMaven.packaging', '');
            vscode.commands.executeCommand('setContext', 'gjsMaven.isAggregator', false);
            vscode.commands.executeCommand('setContext', 'gjsMaven.hasParent', false);
            MavenProjectContext._onDidChange.fire(undefined);
            return;
        }
        MavenProjectContext.updateFromDocument(editor.document.uri.fsPath);
    }
    static updateFromDocument(pomPath) {
        try {
            const text = fs.readFileSync(pomPath, 'utf8');
            // Read only the top-level project fields, not nested ones
            // Strip <parent> and <dependencies> blocks to avoid false matches
            const stripped = text
                .replace(/<parent>[\s\S]*?<\/parent>/g, '')
                .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, '')
                .replace(/<plugins>[\s\S]*?<\/plugins>/g, '');
            const groupId = (stripped.match(/<groupId>([^<]+)/) || [])[1]?.trim() ?? '';
            const artifactId = (stripped.match(/<artifactId>([^<]+)/) || [])[1]?.trim() ?? '';
            const version = (stripped.match(/<version>([^<]+)/) || [])[1]?.trim() ?? '';
            const packaging = (stripped.match(/<packaging>([^<]+)/) || [])[1]?.trim() ?? 'jar';
            const hasParent = /<parent>/.test(text);
            const hasModules = /<modules>/.test(text);
            MavenProjectContext._current = {
                pomPath,
                groupId,
                artifactId,
                version,
                packaging,
                hasParent,
                hasModules
            };
            vscode.commands.executeCommand('setContext', 'gjsMaven.isPom', true);
            vscode.commands.executeCommand('setContext', 'gjsMaven.packaging', packaging);
            vscode.commands.executeCommand('setContext', 'gjsMaven.isAggregator', packaging === 'pom' && hasModules);
            vscode.commands.executeCommand('setContext', 'gjsMaven.hasParent', hasParent);
            MavenProjectContext._onDidChange.fire(MavenProjectContext._current);
        }
        catch {
            MavenProjectContext._current = undefined;
            MavenProjectContext._onDidChange.fire(undefined);
        }
    }
}
exports.MavenProjectContext = MavenProjectContext;
MavenProjectContext._globalConfig = { localRepository: '' };
MavenProjectContext._onDidChange = new vscode.EventEmitter();
MavenProjectContext.onDidChange = MavenProjectContext._onDidChange.event;
//# sourceMappingURL=MavenProjectContext.js.map