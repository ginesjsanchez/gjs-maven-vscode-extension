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
exports.MavenProfileManager = void 0;
const vscode = __importStar(require("vscode"));
class MavenProfileManager {
    constructor(context, statusBar) {
        this.context = context;
        this.statusBar = statusBar;
    }
    getActiveProfiles() {
        return this.context.workspaceState.get(MavenProfileManager.KEY, []);
    }
    buildProfileArg() {
        const profiles = this.getActiveProfiles();
        return profiles.length > 0 ? ` -P ${profiles.join(',')}` : '';
    }
    // Called from command palette (no name: shows quick pick)
    // Called from webview (name provided directly)
    async addProfile(name) {
        if (!name) {
            const input = await vscode.window.showInputBox({
                placeHolder: 'e.g. dev, local, prod',
                prompt: 'Enter Maven profile name to activate',
                validateInput: v => v.trim() === '' ? 'Profile name cannot be empty' : undefined
            });
            if (!input) {
                return;
            }
            name = input.trim();
        }
        const profiles = this.getActiveProfiles();
        if (profiles.includes(name)) {
            vscode.window.showInformationMessage(`Profile '${name}' is already active.`);
            return;
        }
        profiles.push(name);
        await this.save(profiles);
    }
    // Called from command palette (no name: shows quick pick)
    // Called from webview (name provided directly)
    async removeProfile(name) {
        const profiles = this.getActiveProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No active profiles to remove.');
            return;
        }
        if (!name) {
            const pick = await vscode.window.showQuickPick(profiles, {
                placeHolder: 'Select profile to deactivate'
            });
            if (!pick) {
                return;
            }
            name = pick;
        }
        await this.save(profiles.filter(p => p !== name));
    }
    async clearProfiles() {
        const profiles = this.getActiveProfiles();
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No active profiles.');
            return;
        }
        await this.save([]);
        vscode.window.showInformationMessage('All Maven profiles cleared.');
    }
    async save(profiles) {
        await this.context.workspaceState.update(MavenProfileManager.KEY, profiles);
        this.statusBar.setReady(profiles);
    }
}
exports.MavenProfileManager = MavenProfileManager;
MavenProfileManager.KEY = 'gjsMaven.activeProfiles';
//# sourceMappingURL=MavenProfileManager.js.map