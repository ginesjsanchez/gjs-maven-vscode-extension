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
exports.MavenLifecycleProvider = void 0;
const vscode = __importStar(require("vscode"));
const PHASES = [
    { phase: 'clean', icon: 'trash', description: 'Remove previous build output' },
    { phase: 'validate', icon: 'check', description: 'Validate project structure' },
    { phase: 'compile', icon: 'symbol-class', description: 'Compile source code' },
    { phase: 'test', icon: 'beaker', description: 'Run unit tests' },
    { phase: 'package', icon: 'archive', description: 'Package compiled code (jar/war)' },
    { phase: 'verify', icon: 'verified', description: 'Run integration tests' },
    { phase: 'install', icon: 'desktop-download', description: 'Install to local repository' },
    { phase: 'deploy', icon: 'cloud-upload', description: 'Deploy to remote repository' },
    { phase: 'clean package', icon: 'play', description: 'Clean and build the package' },
    { phase: 'clean install', icon: 'play', description: 'Clean, build the package and install' },
    { phase: 'clean deploy', icon: 'play', description: 'Clean, build the package, install and deploy' },
    { phase: 'site', icon: 'globe', description: 'Generate project site' },
];
class MavenLifecycleProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    getTreeItem(element) { return element; }
    getChildren() {
        return PHASES.map(p => new LifecycleItem(p.phase, p.icon, p.description));
    }
}
exports.MavenLifecycleProvider = MavenLifecycleProvider;
class LifecycleItem extends vscode.TreeItem {
    constructor(phase, icon, description) {
        super(phase, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.tooltip = description;
        this.description = description;
        this.contextValue = 'mavenGoal';
        this.command = {
            command: 'gjs-maven-vscode-extension.runFromLifecycle',
            title: `Run: ${phase}`,
            arguments: [phase]
        };
    }
}
//# sourceMappingURL=MavenLifecycleProvider.js.map