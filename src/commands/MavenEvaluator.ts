import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

export class MavenEvaluator {

    constructor(
		private runner: import('./MavenCommandRunner').MavenCommandRunner
    ) {}

    async evaluate(expression: string, projectDir: string): Promise<string | undefined> {
		return this.runner.runToString(`help:evaluate -Dexpression=${expression} -q -DforceStdout`, projectDir )
    }

    async runInteractive(projectDir: string): Promise<void> {
        const expression = await vscode.window.showInputBox({
            prompt: 'Enter Maven expression to evaluate',
            placeHolder: 'e.g. project.version  or  settings.localRepository',
        });
        if (!expression) { return; }

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Evaluating ${expression}...`,
                cancellable: false
            },
            async () => this.evaluate(expression, projectDir)
        );

        if (result === undefined) {
            vscode.window.showErrorMessage(`Could not evaluate '${expression}'. Check Maven configuration.`);
            return;
        }

        const channel = MavenEvaluator.getOutputChannel();
        channel.appendLine(`\n> mvn help:evaluate -Dexpression=${expression}`);
        channel.appendLine(result);
        channel.show(true);
    }

    private static _channel: vscode.OutputChannel | undefined;
    private static getOutputChannel(): vscode.OutputChannel {
        if (!MavenEvaluator._channel) {
            MavenEvaluator._channel = vscode.window.createOutputChannel('Maven Evaluate');
        }
        return MavenEvaluator._channel;
    }

}
