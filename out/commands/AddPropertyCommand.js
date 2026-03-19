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
exports.AddPropertyCommand = void 0;
const vscode = __importStar(require("vscode"));
const PomTextStatus_1 = require("../types/PomTextStatus");
class AddPropertyCommand {
    async execute(targetPomUri) {
        const input = await vscode.window.showInputBox({
            placeHolder: 'property[=value]',
            prompt: 'Enter property name and value',
            validateInput: v => v.split('=').length < 1 ? 'Format: property[=value]' : undefined
        });
        if (!input) {
            return;
        }
        const parts = input.split('=');
        const name = parts[0];
        const value = parts.length > 1 ? parts[1] : undefined;
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
        await this.insertProperty(targetPom, name, value);
    }
    async insertProperty(pomUri, name, value) {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();
        const pomTextStatus = new PomTextStatus_1.PomTextStatus(text);
        const spaces = '        ';
        const propXml = value ? `${spaces}<${name}>${value}</${name}>\n` : `${spaces}<${name}/>`;
        let textXml = propXml;
        const edit = new vscode.WorkspaceEdit();
        let depsCloseIdx = -1;
        if (!pomTextStatus.hasProperties) {
            textXml = `\n    <properties>\n${propXml}\n    </properties>\n`;
            depsCloseIdx = pomTextStatus.postHeader;
        }
        else {
            depsCloseIdx = pomTextStatus.propertiesEnd;
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
        vscode.window.showInformationMessage(`Added property ${name} to pom.xml`);
    }
}
exports.AddPropertyCommand = AddPropertyCommand;
//# sourceMappingURL=AddPropertyCommand.js.map