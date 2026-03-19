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
exports.MavenOptionsManager = void 0;
const vscode = __importStar(require("vscode"));
class MavenOptionsManager {
    constructor(context) {
        this.context = context;
    }
    getOptions() {
        return this.context.workspaceState.get(MavenOptionsManager.KEY_OPTIONS, []);
    }
    isDebug() {
        return this.context.workspaceState.get(MavenOptionsManager.KEY_DEBUG, false);
    }
    buildOptionsArg() {
        const opts = this.getOptions().map(o => {
            // Already has -D prefix → leave as is
            if (o.startsWith('-')) {
                return o;
            }
            return `-D${o}`;
        });
        if (this.isDebug()) {
            opts.push('-X');
        }
        return opts.length > 0 ? ' ' + opts.join(' ') : '';
    }
    async addOption(name) {
        if (!name) {
            const input = await vscode.window.showInputBox({
                placeHolder: 'e.g. skipTests  or  maven.test.skip=true',
                prompt: 'Enter option (word or key=value). -D will be added automatically.',
                validateInput: v => v.trim() === '' ? 'Option cannot be empty' : undefined
            });
            if (!input) {
                return;
            }
            name = input.trim();
        }
        const options = this.getOptions();
        if (options.includes(name)) {
            vscode.window.showInformationMessage(`Option '${name}' is already set.`);
            return;
        }
        options.push(name);
        await this.saveOptions(options);
    }
    async removeOption(name) {
        const options = this.getOptions();
        if (options.length === 0) {
            vscode.window.showInformationMessage('No additional options set.');
            return;
        }
        if (!name) {
            const pick = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select option to remove'
            });
            if (!pick) {
                return;
            }
            name = pick;
        }
        await this.saveOptions(options.filter(o => o !== name));
    }
    async clearOptions() {
        await this.saveOptions([]);
    }
    async setDebug(enabled) {
        await this.context.workspaceState.update(MavenOptionsManager.KEY_DEBUG, enabled);
    }
    async saveOptions(options) {
        await this.context.workspaceState.update(MavenOptionsManager.KEY_OPTIONS, options);
    }
}
exports.MavenOptionsManager = MavenOptionsManager;
MavenOptionsManager.KEY_OPTIONS = 'gjsMaven.additionalOptions';
MavenOptionsManager.KEY_DEBUG = 'gjsMaven.debugMode';
//# sourceMappingURL=MavenOptionsManager.js.map