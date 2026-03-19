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
exports.AddPluginCommand = void 0;
const vscode = __importStar(require("vscode"));
const PomTextStatus_1 = require("../types/PomTextStatus");
const KnownPlugins_1 = require("../data/KnownPlugins");
class AddPluginCommand {
    async execute(targetPomUri, management = false) {
        const pick = await vscode.window.showQuickPick(KnownPlugins_1.KNOWN_PLUGS, {
            placeHolder: 'Search for a plugin to add to pom.xml',
            matchOnDetail: true
        });
        if (!pick) {
            return;
        }
        let groupId = pick.groupId;
        let artifactId = pick.artifactId;
        let version = pick.version;
        if (!groupId) {
            // Custom plugin
            const input = await vscode.window.showInputBox({
                placeHolder: management ? 'groupId:artifactId:version' : 'groupId:artifactId[:version]',
                prompt: 'Enter plugin coordinates',
                validateInput: v => v.split(':').length < (management ? 3 : 2) ? (management ? 'Format: groupId:artifactId:version' : 'Format: groupId:artifactId') : undefined
            });
            if (!input) {
                return;
            }
            const parts = input.split(':');
            groupId = parts[0];
            artifactId = parts[1];
            version = parts.length > 2 ? parts[2] : undefined;
        }
        else if (!management) {
            version = undefined;
        }
        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**');
        if (poms.length === 0) {
            vscode.window.showErrorMessage('No pom.xml found in workspace.');
            return;
        }
        let targetPom = targetPomUri;
        if (!targetPomUri && poms.length > 1) {
            const chosen = await vscode.window.showQuickPick(poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })), { placeHolder: 'Select pom.xml to modify' });
            if (!chosen) {
                return;
            }
            targetPom = chosen.uri;
        }
        await this.insertPlugin(targetPom, management, groupId, artifactId, version);
    }
    async insertPlugin(pomUri, management, groupId, artifactId, version) {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();
        const pomTextStatus = new PomTextStatus_1.PomTextStatus(text);
        const spaces = management ? '                ' : '            ';
        const versionXml = version ? `\n${spaces}    <version>${version}</version>` : '';
        const depXml = `${spaces}<plugin>\n` +
            `${spaces}    <groupId>${groupId}</groupId>\n` +
            `${spaces}    <artifactId>${artifactId}</artifactId>${versionXml}\n` +
            `${spaces}</plugin>\n`;
        const edit = new vscode.WorkspaceEdit();
        // Try to insert before </plugins>
        let textXml = depXml;
        let depsCloseIdx = -1;
        if (management) {
            if (!pomTextStatus.hasBuild) {
                textXml = `\n    <build>\n    <pluginManagement>\n            <plugins>\n${depXml}\n            </plugins>\n        </pluginManagement>\n    </build>\n`;
                depsCloseIdx = pomTextStatus.postDependencies;
            }
            else if (!pomTextStatus.hasManagedPlugins) {
                textXml = `\n        <pluginManagement>\n        <plugins>\n${depXml}\n            </plugins>\n        <pluginManagement>\n`;
                if (pomTextStatus.hasMPPlugins) {
                    depsCloseIdx = pomTextStatus.mpPluginsStart;
                }
                else {
                    depsCloseIdx = pomTextStatus.buildEnd;
                }
            }
            else if (!pomTextStatus.hasMPPlugins) {
                textXml = `\n        <plugins>\n${depXml}\n             </plugins>\n`;
                depsCloseIdx = pomTextStatus.managedPluginsEnd;
            }
            else {
                depsCloseIdx = pomTextStatus.mpPluginsEnd;
            }
        }
        else {
            if (!pomTextStatus.hasBuild) {
                textXml = `\n    <build>\n        <plugins>\n${depXml}\n        </plugins>\n    </build>\n`;
                depsCloseIdx = pomTextStatus.postDependencies;
            }
            else if (!pomTextStatus.hasPlugins) {
                textXml = `\n    <plugins>\n${depXml}\n        </plugins>\n`;
                depsCloseIdx = pomTextStatus.buildEnd;
            }
            else {
                depsCloseIdx = pomTextStatus.pluginsEnd;
            }
        }
        if (depsCloseIdx === -1) {
            // Try to insert a new <plugins> block before </project>
            depsCloseIdx = text.lastIndexOf('</project>');
            if (depsCloseIdx === -1) {
                vscode.window.showErrorMessage('Could not find a valid insertion point in pom.xml.');
                return;
            }
        }
        const pos = doc.positionAt(depsCloseIdx);
        edit.insert(pomUri, pos, textXml);
        await vscode.workspace.applyEdit(edit);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`Added ${groupId}${artifactId}:${version} to pom.xml`);
    }
}
exports.AddPluginCommand = AddPluginCommand;
//# sourceMappingURL=AddPluginCommand.js.map