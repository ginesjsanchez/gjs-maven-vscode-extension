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
exports.AddDependencyCommand = void 0;
const vscode = __importStar(require("vscode"));
const PomTextStatus_1 = require("../types/PomTextStatus");
const KnownDependencies_1 = require("../data/KnownDependencies");
class AddDependencyCommand {
    async execute(targetPomUri, management = false) {
        const pick = await vscode.window.showQuickPick(KnownDependencies_1.KNOWN_DEPS, {
            placeHolder: 'Search for a dependency to add to pom.xml',
            matchOnDetail: true
        });
        if (!pick) {
            return;
        }
        let groupId = pick.groupId;
        let artifactId = pick.artifactId;
        let version = pick.version;
        let scope = pick.scope;
        if (!groupId) {
            // Custom dependency
            const input = await vscode.window.showInputBox({
                placeHolder: management ? 'groupId:artifactId:version[:scope]' : 'groupId:artifactId[:version][:scope]',
                prompt: 'Enter dependency coordinates',
                validateInput: v => v.split(':').length < (management ? 3 : 2) ? (management ? 'Format: groupId:artifactId:version' : 'Format: groupId:artifactId') : undefined
            });
            if (!input) {
                return;
            }
            const parts = input.split(':');
            groupId = parts[0];
            artifactId = parts[1];
            version = parts.length > 2 ? parts[2] : undefined;
            scope = parts.length > 3 ? parts[3] : undefined;
        }
        else if (!management) {
            version = undefined;
            scope = undefined;
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
        await this.insertDependency(targetPom, management, groupId, artifactId, version, scope);
    }
    async insertDependency(pomUri, management, groupId, artifactId, version, scope) {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();
        const pomTextStatus = new PomTextStatus_1.PomTextStatus(text);
        const spaces = management ? '            ' : '        ';
        const versionXml = version ? `\n${spaces}    <version>${version}</version>` : '';
        const scopeXml = scope ? `\n${spaces}    <scope>${scope}</scope>` : '';
        const depXml = `${spaces}<dependency>\n` +
            `${spaces}    <groupId>${groupId}</groupId>\n` +
            `${spaces}    <artifactId>${artifactId}</artifactId>` +
            `            ${versionXml}${scopeXml}\n` +
            `${spaces}</dependency>\n`;
        const edit = new vscode.WorkspaceEdit();
        // Try to insert before </dependencies>
        let textXml = depXml;
        let depsCloseIdx = -1;
        if (management) {
            if (!pomTextStatus.hasManagedDependencies) {
                textXml = `\n    <dependencyManagement>\n        <dependencies>\n${depXml}\n        </dependencies>\n    <dependencyManagement>\n`;
                depsCloseIdx = pomTextStatus.postHeader;
            }
            else if (!pomTextStatus.hasMDDependencies) {
                textXml = `\n    <dependencies>\n${depXml}\n        </dependencies>\n`;
                depsCloseIdx = pomTextStatus.managedDependenciesEnd;
            }
            else {
                depsCloseIdx = pomTextStatus.mdDependenciesEnd;
            }
        }
        else {
            if (!pomTextStatus.hasDependencies) {
                textXml = `\n    <dependencies>\n${depXml}\n        </dependencies>\n`;
                depsCloseIdx = pomTextStatus.postManagedDependencies;
            }
            else {
                depsCloseIdx = pomTextStatus.dependenciesEnd;
            }
        }
        if (depsCloseIdx === -1) {
            // Try to insert a new <dependencies> block before </project>
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
exports.AddDependencyCommand = AddDependencyCommand;
//# sourceMappingURL=AddDependencyCommand.js.map