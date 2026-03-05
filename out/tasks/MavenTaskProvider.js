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
exports.MavenTaskProvider = void 0;
const vscode = __importStar(require("vscode"));
class MavenTaskProvider {
    constructor(runner) {
        this.runner = runner;
    }
    provideTasks() {
        const goals = ['clean', 'compile', 'test', 'package', 'install', 'deploy', 'clean install'];
        return goals.map(goal => {
            const def = { type: MavenTaskProvider.TaskType, goals: [goal] };
            const task = new vscode.Task(def, vscode.TaskScope.Workspace, goal, 'Gjs Maven VS Code Extension', new vscode.ShellExecution(`mvn ${goal}`), '$maven');
            task.group = goal === 'test' ? vscode.TaskGroup.Test : vscode.TaskGroup.Build;
            return task;
        });
    }
    resolveTask(task) {
        const def = task.definition;
        if (def.type === MavenTaskProvider.TaskType && def.goals) {
            const goals = Array.isArray(def.goals) ? def.goals.join(' ') : def.goals;
            const profiles = def.profiles ? ` -P ${def.profiles.join(',')}` : '';
            const options = def.options ?? '';
            const resolved = new vscode.Task(def, task.scope ?? vscode.TaskScope.Workspace, task.name, 'Gjs Maven VS Code Extension', new vscode.ShellExecution(`mvn ${goals}${profiles} ${options}`.trim()), '$maven');
            return resolved;
        }
        return undefined;
    }
}
exports.MavenTaskProvider = MavenTaskProvider;
MavenTaskProvider.TaskType = 'maven';
//# sourceMappingURL=MavenTaskProvider.js.map