import * as vscode from 'vscode';
import {
    Entry, SectionName, collect, readActivePom,
    PomEntryItem, PomVariantItem, makeInfoItem
} from './PomModel';

/**
 * Los cuatro paneles son el mismo panel con otra sección y otro icono, así que
 * comparten implementación. Cada fila es un elemento del pom; sus hijos, si los
 * tiene, son lo que aporta cada perfil.
 */
abstract class PomSectionProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    protected abstract readonly section: SectionName;
    protected abstract readonly icon: string;
    protected abstract readonly emptyMessage: string;
    protected abstract readonly noPomMessage: string;

    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element instanceof PomEntryItem) {
            return element.entry.profiles.map(v => new PomVariantItem(v));
        }
        if (element) { return []; }

        const project = readActivePom();
        if (!project) { return [makeInfoItem(this.noPomMessage)]; }

        const entries = collect(project, this.section);
        if (entries.length === 0) { return [makeInfoItem(this.emptyMessage)]; }
        return entries.map(e => new PomEntryItem(e, this.iconFor(e)));
    }

    /** Por defecto el icono de la sección; las dependencias lo afinan por scope. */
    protected iconFor(_entry: Entry): vscode.ThemeIcon {
        return new vscode.ThemeIcon(this.icon);
    }
}

//  Plugins

export class MavenPluginsProvider extends PomSectionProvider {
    protected readonly section: SectionName = 'plugins';
    protected readonly icon = 'extensions';
    protected readonly emptyMessage = 'No plugins configured';
    protected readonly noPomMessage = 'Open a pom.xml to see plugins';
}

export class MavenManagedPluginsProvider extends PomSectionProvider {
    protected readonly section: SectionName = 'managedPlugins';
    protected readonly icon = 'extensions';
    protected readonly emptyMessage = 'No managed plugins configured';
    protected readonly noPomMessage = 'Open a pom.xml to see managed plugins';
}

//  Dependencies

abstract class DependencyProvider extends PomSectionProvider {
    protected readonly icon = 'library';

    protected iconFor(entry: Entry): vscode.ThemeIcon {
        // El scope viaja dentro del valor mostrado, entre corchetes
        const value = entry.base?.value ?? entry.profiles[0]?.value ?? '';
        const scope = (value.match(/\[([^\]]+)\]/) || [])[1] ?? 'compile';
        return scopeIcon(scope);
    }
}

export class MavenDependenciesProvider extends DependencyProvider {
    protected readonly section: SectionName = 'dependencies';
    protected readonly emptyMessage = 'No dependencies declared';
    protected readonly noPomMessage = 'Open a pom.xml to see dependencies';
}

export class MavenManagedDependenciesProvider extends DependencyProvider {
    protected readonly section: SectionName = 'managedDependencies';
    protected readonly emptyMessage = 'No managed dependencies declared';
    protected readonly noPomMessage = 'Open a pom.xml to see managed dependencies';
}

function scopeIcon(scope: string): vscode.ThemeIcon {
    const icons: Record<string, string> = {
        compile: 'library', provided: 'server', runtime: 'run',
        test: 'beaker', system: 'warning', import: 'file-symlink-file',
    };
    return new vscode.ThemeIcon(icons[scope] ?? 'library');
}
