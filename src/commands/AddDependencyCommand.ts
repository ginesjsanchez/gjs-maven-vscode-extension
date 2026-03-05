import * as vscode from 'vscode';

// Well-known dependencies by category for quick-pick
const KNOWN_DEPS: { label: string; detail: string; groupId: string; artifactId: string; version: string; scope?: string }[] = [
    // Java / JUnit
    { label: 'JUnit 5', detail: 'Unit testing framework', groupId: 'org.junit.jupiter', artifactId: 'junit-jupiter', version: '5.10.1', scope: 'test' },
    { label: 'JUnit 4', detail: 'Classic unit testing', groupId: 'junit', artifactId: 'junit', version: '4.13.2', scope: 'test' },
    { label: 'Mockito', detail: 'Mocking framework', groupId: 'org.mockito', artifactId: 'mockito-core', version: '5.8.0', scope: 'test' },
    { label: 'AssertJ', detail: 'Fluent assertions', groupId: 'org.assertj', artifactId: 'assertj-core', version: '3.24.2', scope: 'test' },
    // Spring
    { label: 'Spring Boot Starter Web', detail: 'Spring MVC + embedded Tomcat', groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-web', version: '3.2.1' },
    { label: 'Spring Boot Starter Data JPA', detail: 'JPA persistence', groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-data-jpa', version: '3.2.1' },
    { label: 'Spring Boot Starter Test', detail: 'Spring test utilities', groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-test', version: '3.2.1', scope: 'test' },
    // Logging
    { label: 'SLF4J API', detail: 'Logging facade', groupId: 'org.slf4j', artifactId: 'slf4j-api', version: '2.0.10' },
    { label: 'Logback', detail: 'SLF4J implementation', groupId: 'ch.qos.logback', artifactId: 'logback-classic', version: '1.4.14' },
    // JSON
    { label: 'Jackson Databind', detail: 'JSON serialization', groupId: 'com.fasterxml.jackson.core', artifactId: 'jackson-databind', version: '2.16.1' },
    { label: 'Gson', detail: 'Google JSON library', groupId: 'com.google.code.gson', artifactId: 'gson', version: '2.10.1' },
    // C++ / NAR
    { label: 'NAR Maven Plugin (C/C++)', detail: 'Native code build support', groupId: 'com.github.maven-nar', artifactId: 'nar-maven-plugin', version: '3.10.1' },
    // Python / Jython
    { label: 'Jython', detail: 'Python interpreter for JVM', groupId: 'org.python', artifactId: 'jython-standalone', version: '2.7.3' },
    // Utilities
    { label: 'Apache Commons Lang', detail: 'Utility methods', groupId: 'org.apache.commons', artifactId: 'commons-lang3', version: '3.14.0' },
    { label: 'Guava', detail: 'Google core libraries', groupId: 'com.google.guava', artifactId: 'guava', version: '33.0.0-jre' },
    { label: 'Lombok', detail: 'Boilerplate reduction annotations', groupId: 'org.projectlombok', artifactId: 'lombok', version: '1.18.30', scope: 'provided' },
    { label: '[ Custom dependency... ]', detail: 'Enter groupId:artifactId:version manually', groupId: '', artifactId: '', version: '' },
];

export class AddDependencyCommand {
    async execute(): Promise<void> {
        const pick = await vscode.window.showQuickPick(KNOWN_DEPS, {
            placeHolder: 'Search for a dependency to add to pom.xml',
            matchOnDetail: true
        });
        if (!pick) { return; }

        let { groupId, artifactId, version, scope } = pick;

        if (!groupId) {
            // Custom dependency
            const input = await vscode.window.showInputBox({
                placeHolder: 'groupId:artifactId:version[:scope]',
                prompt: 'Enter dependency coordinates',
                validateInput: v => v.split(':').length < 3 ? 'Format: groupId:artifactId:version' : undefined
            });
            if (!input) { return; }
            const parts = input.split(':');
            groupId = parts[0]; artifactId = parts[1]; version = parts[2]; scope = parts[3];
        }

        const poms = await vscode.workspace.findFiles('**/pom.xml', '**/node_modules/**');
        if (poms.length === 0) {
            vscode.window.showErrorMessage('No pom.xml found in workspace.');
            return;
        }

        let targetPom = poms[0];
        if (poms.length > 1) {
            const chosen = await vscode.window.showQuickPick(
                poms.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
                { placeHolder: 'Select pom.xml to modify' }
            );
            if (!chosen) { return; }
            targetPom = chosen.uri;
        }

        await this.insertDependency(targetPom, groupId, artifactId, version, scope);
    }

    private async insertDependency(
        pomUri: vscode.Uri,
        groupId: string,
        artifactId: string,
        version: string,
        scope?: string
    ): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(pomUri);
        const text = doc.getText();

        const scopeXml = scope ? `\n            <scope>${scope}</scope>` : '';
        const depXml =
            `        <dependency>\n` +
            `            <groupId>${groupId}</groupId>\n` +
            `            <artifactId>${artifactId}</artifactId>\n` +
            `            <version>${version}</version>${scopeXml}\n` +
            `        </dependency>`;

        const edit = new vscode.WorkspaceEdit();

        // Try to insert before </dependencies>
        const depsCloseIdx = text.lastIndexOf('</dependencies>');
        if (depsCloseIdx !== -1) {
            const pos = doc.positionAt(depsCloseIdx);
            edit.insert(pomUri, pos, depXml + '\n');
        } else {
            // Try to insert a new <dependencies> block before </project>
            const projCloseIdx = text.lastIndexOf('</project>');
            if (projCloseIdx === -1) {
                vscode.window.showErrorMessage('Could not find a valid insertion point in pom.xml.');
                return;
            }
            const pos = doc.positionAt(projCloseIdx);
            edit.insert(pomUri, pos, `    <dependencies>\n${depXml}\n    </dependencies>\n`);
        }

        await vscode.workspace.applyEdit(edit);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`Added ${artifactId}:${version} to pom.xml`);
    }
}
