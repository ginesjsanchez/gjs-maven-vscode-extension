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
exports.MavenEvaluator = void 0;
const vscode = __importStar(require("vscode"));
class MavenEvaluator {
    constructor(runner) {
        this.runner = runner;
    }
    async evaluate(expression, projectDir) {
        return this.runner.runToString(`help:evaluate -Dexpression=${expression} -q -DforceStdout`, projectDir);
    }
    async runInteractive(projectDir) {
        const expression = await vscode.window.showInputBox({
            prompt: 'Enter Maven expression to evaluate',
            placeHolder: 'e.g. project.version  or  settings.localRepository',
        });
        if (!expression) {
            return;
        }
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Evaluating ${expression}...`,
            cancellable: false
        }, async () => this.evaluate(expression, projectDir));
        if (result === undefined) {
            vscode.window.showErrorMessage(`Could not evaluate '${expression}'. Check Maven configuration.`);
            return;
        }
        const channel = MavenEvaluator.getOutputChannel();
        channel.appendLine(`\n> mvn help:evaluate -Dexpression=${expression}`);
        channel.appendLine(result);
        channel.show(true);
    }
    static getOutputChannel() {
        if (!MavenEvaluator._channel) {
            MavenEvaluator._channel = vscode.window.createOutputChannel('Maven Evaluate');
        }
        return MavenEvaluator._channel;
    }
}
exports.MavenEvaluator = MavenEvaluator;
//# sourceMappingURL=MavenEvaluator.js.map