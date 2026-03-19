import * as vscode from 'vscode';
import { PomTextStatus } from '../types/PomTextStatus';


export class AddPropertyCommand {
    async execute(targetPomUri: vscode.Uri): Promise<void> {
			
		const input = await vscode.window.showInputBox({
			placeHolder: 'property[=value]',
			prompt: 'Enter property name and value',
			validateInput: v => v.split('=').length < 1 ? 'Format: property[=value]' : undefined
		});
		if (!input) { return; }
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
            const chosen = await vscode.window.showQuickPick(
                poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
                { placeHolder: 'Select pom.xml to modify' }
            );
            if (!chosen) { return; }
            targetPom = chosen.uri;
        }

        await this.insertProperty(targetPom,  name, value);
    }

	
    private async insertProperty(
        pomUri: vscode.Uri,
        name: string,
        value?: string
    ): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();

		const pomTextStatus = new PomTextStatus(text);

		const spaces = '        ';
        const propXml = value ? `${spaces}<${name}>${value}</${name}>\n` : `${spaces}<${name}/>`;
		let textXml = propXml;

        const edit = new vscode.WorkspaceEdit();

		let depsCloseIdx = -1;
		if ( !pomTextStatus.hasProperties ) { 	
			textXml = `\n    <properties>\n${propXml}\n    </properties>\n`
			depsCloseIdx = pomTextStatus.postHeader;
		} else {
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