import * as vscode from 'vscode';
import { PomTextStatus } from '../types/PomTextStatus';
import { KNOWN_DEPS } from '../data/KnownDependencies';


export class AddDependencyCommand {
    async execute(targetPomUri: vscode.Uri, management: boolean = false): Promise<void> {
			
        const pick = await vscode.window.showQuickPick(KNOWN_DEPS, {
            placeHolder: 'Search for a dependency to add to pom.xml',
            matchOnDetail: true
        });
        if (!pick) { return; }

		let groupId:    string           = pick.groupId;
		let artifactId: string           = pick.artifactId;
		let version:    string | undefined = pick.version;
		let scope:      string | undefined = pick.scope;

        if (!groupId) {
            // Custom dependency
            const input = await vscode.window.showInputBox({
                placeHolder: management ? 'groupId:artifactId:version[:scope]' : 'groupId:artifactId[:version][:scope]',
                prompt: 'Enter dependency coordinates',
                validateInput: v => v.split(':').length < (management ? 3 : 2) ? (management ? 'Format: groupId:artifactId:version' : 'Format: groupId:artifactId') : undefined
            });
            if (!input) { return; }
            const parts = input.split(':');
            groupId = parts[0]; 
			artifactId = parts[1]; 
			version = parts.length > 2 ? parts[2] : undefined;
			scope = parts.length > 3 ? parts[3] : undefined;
        } else if ( !management ) {
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
            const chosen = await vscode.window.showQuickPick(
                poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
                { placeHolder: 'Select pom.xml to modify' }
            );
            if (!chosen) { return; }
            targetPom = chosen.uri;
        }

        await this.insertDependency(targetPom, management, groupId, artifactId, version, scope);
    }

	
    private async insertDependency(
        pomUri: vscode.Uri,
		management: boolean,
        groupId: string,
        artifactId: string,
        version?: string,
        scope?: string
    ): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();

		const pomTextStatus = new PomTextStatus(text);

		const spaces = management ? '            ' : '        ';
        const versionXml = version ? `\n${spaces}    <version>${version}</version>` : '';
        const scopeXml = scope ? `\n${spaces}    <scope>${scope}</scope>` : '';
        const depXml =
            `${spaces}<dependency>\n` +
            `${spaces}    <groupId>${groupId}</groupId>\n` +
            `${spaces}    <artifactId>${artifactId}</artifactId>` +
            `            ${versionXml}${scopeXml}\n` +
            `${spaces}</dependency>\n`;

        const edit = new vscode.WorkspaceEdit();

        // Try to insert before </dependencies>
		let textXml = depXml;
		let depsCloseIdx = -1;
		if ( management ) {
			if ( !pomTextStatus.hasManagedDependencies ) {
				textXml = `\n    <dependencyManagement>\n        <dependencies>\n${depXml}\n        </dependencies>\n    <dependencyManagement>\n`
				depsCloseIdx = pomTextStatus.postHeader;
			} else if ( !pomTextStatus.hasMDDependencies ) { 	
				textXml = `\n    <dependencies>\n${depXml}\n        </dependencies>\n`
				depsCloseIdx = pomTextStatus.managedDependenciesEnd;
			} else {
				depsCloseIdx = pomTextStatus.mdDependenciesEnd;
			}
		} else {
			if ( !pomTextStatus.hasDependencies ) { 	
				textXml = `\n    <dependencies>\n${depXml}\n        </dependencies>\n`
				depsCloseIdx = pomTextStatus.postManagedDependencies;
			} else {
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