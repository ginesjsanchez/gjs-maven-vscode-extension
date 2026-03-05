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
exports.MavenStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class MavenStatusBar {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'gjs-maven-vscode-extension.runCommand';
        this.item.hide();
    }
    setReady() {
        const config = vscode.workspace.getConfiguration('mavenPolyglot');
        if (!config.get('showStatusBar', true)) {
            this.item.hide();
            return;
        }
        this.item.text = '$(package) Maven';
        this.item.tooltip = 'Click to run Maven goal';
        this.item.backgroundColor = undefined;
        this.item.show();
    }
    setRunning(goal) {
        this.item.text = `$(loading~spin) mvn ${goal}`;
        this.item.tooltip = `Running: mvn ${goal}`;
        this.item.show();
    }
    setError(goal) {
        this.item.text = `$(error) mvn ${goal} failed`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.item.show();
    }
    dispose() {
        this.item.dispose();
    }
}
exports.MavenStatusBar = MavenStatusBar;
//# sourceMappingURL=MavenStatusBar.js.map