import * as vscode from 'vscode';
import { PomTextStatus } from '../types/PomTextStatus';
import { KNOWN_PLUGS } from '../data/KnownPlugins';


export class AddPluginCommand {
    async execute(targetPomUri: vscode.Uri, management: boolean = false): Promise<void> {
			
        const pick = await vscode.window.showQuickPick(KNOWN_PLUGS, {
            placeHolder: 'Search for a plugin to add to pom.xml',
            matchOnDetail: true
        });
        if (!pick) { return; }

		let groupId:    string           = pick.groupId;
		let artifactId: string           = pick.artifactId;
		let version:    string | undefined = pick.version;

        if (!groupId) {
            // Custom plugin
            const input = await vscode.window.showInputBox({
                placeHolder: management ? 'groupId:artifactId:version' : 'groupId:artifactId[:version]',
                prompt: 'Enter plugin coordinates',
                validateInput: v => v.split(':').length < (management ? 3 : 2) ? (management ? 'Format: groupId:artifactId:version' : 'Format: groupId:artifactId') : undefined
            });
            if (!input) { return; }
            const parts = input.split(':');
            groupId = parts[0]; 
			artifactId = parts[1]; 
			version = parts.length > 2 ? parts[2] : undefined;
        } else if ( !management ) {
			version = undefined
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

        await this.insertPlugin(targetPom, management, groupId, artifactId, version);
    }

	
    private async insertPlugin(
        pomUri: vscode.Uri,
		management: boolean,
        groupId: string,
        artifactId: string,
        version?: string
    ): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();

		const pomTextStatus = new PomTextStatus(text);

		const spaces = management ? '                ' : '            ';
        const versionXml = version ? `\n${spaces}    <version>${version}</version>` : '';
        const depXml =
            `${spaces}<plugin>\n` +
            `${spaces}    <groupId>${groupId}</groupId>\n` +
            `${spaces}    <artifactId>${artifactId}</artifactId>${versionXml}\n` +
            `${spaces}</plugin>\n`;

        const edit = new vscode.WorkspaceEdit();

        // Try to insert before </plugins>
		let textXml = depXml;
		let depsCloseIdx = -1;
		if ( management ) {
			if ( !pomTextStatus.hasBuild ) {
				textXml = `\n    <build>\n    <pluginManagement>\n            <plugins>\n${depXml}\n            </plugins>\n        </pluginManagement>\n    </build>\n`
				depsCloseIdx = pomTextStatus.postDependencies;
			} else if ( !pomTextStatus.hasManagedPlugins ) {
				textXml = `\n        <pluginManagement>\n        <plugins>\n${depXml}\n            </plugins>\n        <pluginManagement>\n`
				if ( pomTextStatus.hasMPPlugins ) {
					depsCloseIdx = pomTextStatus.mpPluginsStart;
				} else {
					depsCloseIdx = pomTextStatus.buildEnd;
				}
			} else if ( !pomTextStatus.hasMPPlugins ) { 	
				textXml = `\n        <plugins>\n${depXml}\n             </plugins>\n`
				depsCloseIdx = pomTextStatus.managedPluginsEnd;
			} else {
				depsCloseIdx = pomTextStatus.mpPluginsEnd;
			}
		} else {
			if ( !pomTextStatus.hasBuild ) {
				textXml = `\n    <build>\n        <plugins>\n${depXml}\n        </plugins>\n    </build>\n`
				depsCloseIdx = pomTextStatus.postDependencies;
			} else if ( !pomTextStatus.hasPlugins ) { 	
				textXml = `\n    <plugins>\n${depXml}\n        </plugins>\n`
				depsCloseIdx = pomTextStatus.buildEnd;
			} else {
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