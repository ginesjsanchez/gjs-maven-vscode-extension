import * as vscode from 'vscode';
import { MavenCommandRunner } from '../commands/MavenCommandRunner';

export class MavenTaskProvider implements vscode.TaskProvider {
    static readonly TaskType = 'maven';

    constructor(private runner: MavenCommandRunner) {}

    provideTasks(): vscode.Task[] {
        const goals = ['clean', 'compile', 'test', 'package', 'install', 'deploy', 'clean install'];
        return goals.map(goal => {
            const def: vscode.TaskDefinition = { type: MavenTaskProvider.TaskType, goals: [goal] };
            const task = new vscode.Task(
                def,
                vscode.TaskScope.Workspace,
                goal,
                'Gjs Maven VS Code Extension',
                new vscode.ShellExecution(`mvn ${goal}`),
                '$maven'
            );
            task.group = goal === 'test' ? vscode.TaskGroup.Test : vscode.TaskGroup.Build;
            return task;
        });
    }

    resolveTask(task: vscode.Task): vscode.Task | undefined {
        const def = task.definition;
        if (def.type === MavenTaskProvider.TaskType && def.goals) {
            const goals = Array.isArray(def.goals) ? def.goals.join(' ') : def.goals;
            const profiles: string = def.profiles ? ` -P ${(def.profiles as string[]).join(',')}` : '';
            const options: string = def.options ?? '';
            const resolved = new vscode.Task(
                def,
                task.scope ?? vscode.TaskScope.Workspace,
                task.name,
                'Gjs Maven VS Code Extension',
                new vscode.ShellExecution(`mvn ${goals}${profiles} ${options}`.trim()),
                '$maven'
            );
            return resolved;
        }
        return undefined;
    }
}
