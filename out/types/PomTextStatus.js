"use strict";
// TODO: Completar toda la información
Object.defineProperty(exports, "__esModule", { value: true });
exports.PomTextStatus = void 0;
class PomTextStatus {
    constructor(text) {
        this.hasParent = false;
        this.hasProperties = false;
        this.hasModules = false;
        this.hasManagedDependencies = false;
        this.hasMDDependencies = false;
        this.hasDependencies = false;
        this.hasBuild = false;
        this.hasManagedPlugins = false;
        this.hasMPPlugins = false;
        this.hasPlugins = false;
        this.hasProfiles = false;
        this.hasReporting = false;
        this.parentStart = -1;
        this.parentEnd = -1;
        this.propertiesStart = -1;
        this.propertiesEnd = -1;
        this.modulesStart = -1;
        this.modulesEnd = -1;
        this.managedDependenciesStart = -1;
        this.managedDependenciesEnd = -1;
        this.mdDependenciesStart = -1;
        this.mdDependenciesEnd = -1;
        this.dependenciesStart = -1;
        this.dependenciesEnd = -1;
        this.buildStart = -1;
        this.buildEnd = -1;
        this.managedPluginsStart = -1;
        this.managedPluginsEnd = -1;
        this.mpPluginsStart = -1;
        this.mpPluginsEnd = -1;
        this.pluginsStart = -1;
        this.pluginsEnd = -1;
        this.profilesStart = -1;
        this.profilesEnd = -1;
        this.reportingStart = -1;
        this.reportingEnd = -1;
        this.postHeader = -1;
        this.postManagedDependencies = -1;
        this.postDependencies = -1;
        this.postBuild = -1;
        if (text) {
            this.parentStart = this.adjustPosBeginLine(text, text.indexOf('<parent>'));
            this.hasParent = this.parentStart !== -1;
            this.parentEnd = this.adjustPosBeginLine(text, text.indexOf('</parent>'));
            this.profilesStart = this.adjustPosBeginLine(text, text.indexOf('<profiles>'));
            this.hasProfiles = this.profilesStart !== -1;
            this.profilesEnd = this.adjustPosBeginLine(text, text.indexOf('</profiles>'));
            if (this.hasProfiles) {
                this.propertiesStart = this.findPosOutside(text, '<properties>', this.profilesStart, this.profilesEnd);
            }
            else {
                this.propertiesStart = this.adjustPosBeginLine(text, text.indexOf('<properties>'));
            }
            this.hasProperties = this.propertiesStart !== -1;
            if (this.hasProperties) {
                this.propertiesEnd = this.adjustPosBeginLine(text, text.indexOf('</properties>', this.propertiesStart));
            }
            if (this.hasProfiles) {
                this.modulesStart = this.findPosOutside(text, '<modules>', this.profilesStart, this.profilesEnd);
            }
            else {
                this.modulesStart = this.adjustPosBeginLine(text, text.indexOf('<modules>'));
            }
            this.hasModules = this.modulesStart !== -1;
            if (this.hasProperties) {
                this.modulesEnd = this.adjustPosBeginLine(text, text.indexOf('</modules>', this.modulesStart));
            }
            if (this.hasProfiles) {
                this.managedDependenciesStart = this.findPosOutside(text, '<dependencyManagement>', this.profilesStart, this.profilesEnd);
            }
            else {
                this.managedDependenciesStart = text.indexOf('<dependencyManagement>');
            }
            this.hasManagedDependencies = this.managedDependenciesStart !== -1;
            if (this.hasManagedDependencies) {
                this.managedDependenciesEnd = this.adjustPosBeginLine(text, text.indexOf('</dependencyManagement>', this.managedDependenciesStart));
                this.mdDependenciesStart = this.findPosInside(text, '<dependencies>', this.managedDependenciesStart, this.managedDependenciesEnd);
                this.hasMDDependencies = this.mdDependenciesStart !== -1;
                if (this.hasMDDependencies) {
                    this.mdDependenciesEnd = this.adjustPosBeginLine(text, text.indexOf('</dependencies>', this.mdDependenciesStart));
                }
            }
            if (this.hasManagedDependencies && this.hasProfiles) {
                this.dependenciesStart = this.findPosOutsideExt(text, '<dependencies>', this.managedDependenciesStart, this.managedDependenciesEnd, this.profilesStart, this.profilesEnd);
            }
            else if (this.hasManagedDependencies) {
                this.dependenciesStart = this.findPosOutside(text, '<dependencies>', this.managedDependenciesStart, this.managedDependenciesEnd);
            }
            else if (this.hasProfiles) {
                this.dependenciesStart = this.findPosOutside(text, '<dependencies>', this.profilesStart, this.profilesEnd);
            }
            else {
                this.dependenciesStart = this.adjustPosBeginLine(text, text.indexOf('<dependencies>'));
            }
            this.hasDependencies = this.dependenciesStart !== -1;
            if (this.hasDependencies) {
                this.dependenciesEnd = this.adjustPosBeginLine(text, text.indexOf('</dependencies>', this.dependenciesStart));
            }
            if (this.hasProfiles) {
                this.buildStart = this.findPosOutside(text, '<build>', this.profilesStart, this.profilesEnd);
            }
            else {
                this.buildStart = this.adjustPosBeginLine(text, text.indexOf('<build>'));
            }
            this.hasBuild = this.buildStart !== -1;
            if (this.hasBuild) {
                this.buildEnd = this.adjustPosBeginLine(text, text.indexOf('</build>', this.buildStart));
                this.managedPluginsStart = this.findPosInside(text, '<pluginManagement>', this.buildStart, this.buildEnd);
                this.hasManagedPlugins = this.managedPluginsStart !== -1;
                if (this.hasManagedPlugins) {
                    this.managedPluginsEnd = this.findPosInside(text, '</pluginManagement>', this.managedPluginsStart, this.buildEnd);
                    this.mpPluginsStart = this.findPosInside(text, '<plugins>', this.managedPluginsStart, this.managedPluginsEnd);
                    this.hasMPPlugins = this.mpPluginsStart !== -1;
                    if (this.hasMPPlugins) {
                        this.mpPluginsEnd = this.adjustPosBeginLine(text, text.indexOf('</plugins>', this.mpPluginsStart));
                    }
                    this.pluginsStart = this.findPosInsideOutside(text, '<plugins>', this.buildStart, this.buildEnd, this.managedPluginsStart, this.managedPluginsEnd);
                }
                else {
                    this.pluginsStart = this.findPosInside(text, '<plugins>', this.buildStart, this.buildEnd);
                }
                this.hasPlugins = this.pluginsStart !== -1;
                if (this.hasPlugins) {
                    this.pluginsEnd = this.adjustPosBeginLine(text, text.indexOf('</plugins>', this.pluginsStart));
                }
            }
            if (this.hasProfiles) {
                this.reportingStart = this.findPosOutside(text, '<reporting>', this.profilesStart, this.profilesEnd);
            }
            else {
                this.reportingStart = this.adjustPosBeginLine(text, text.indexOf('<reporting>'));
            }
            this.hasReporting = this.reportingStart !== -1;
            if (this.hasReporting) {
                this.reportingEnd = this.adjustPosBeginLine(text, text.indexOf('</reporting>', this.reportingStart));
            }
            this.postHeader = this.findPosBehind(text, ['</properties>', '</ciManagement>', '</issueManagement>', '</scm>', '</mailingLists>',
                '</contributors>', '</developers>', '</licenses>', '</organization>', '</inceptionYear>',
                '</url>', '</description>', '</name>', '</packaging>', '</version>', '<artifactId>',
                '</groupId>', '</parent>']);
            this.postManagedDependencies = Math.max(this.postHeader, this.adjustPosNextLine(text, this.managedDependenciesEnd));
            this.postDependencies = Math.max(this.postManagedDependencies, this.adjustPosNextLine(text, this.dependenciesEnd));
            this.postBuild = Math.max(this.postDependencies, this.adjustPosNextLine(text, this.buildEnd));
        }
    }
    findPosOutside(text, tag, posStart, posEnd) {
        let pos = -1;
        let searchFrom = 0;
        while (true) {
            const idx = text.indexOf(tag, searchFrom);
            if (idx === -1) {
                break;
            }
            // Si está dentro del bloque mgmt, saltarlo
            if (idx > posStart && idx < posEnd) {
                searchFrom = idx + 1;
                continue;
            }
            pos = idx;
            break;
        }
        return this.adjustPosBeginLine(text, pos);
    }
    findPosInside(text, tag, posStart, posEnd) {
        let pos = -1;
        const idx = text.indexOf(tag, posStart);
        if (idx > posStart && idx < posEnd) {
            pos = idx;
        }
        return this.adjustPosBeginLine(text, pos);
    }
    findPosInsideOutside(text, tag, posStart, posEnd, posOutStart, posOutEnd) {
        let pos = -1;
        let searchFrom = posStart;
        while (true) {
            const idx = text.indexOf(tag, searchFrom);
            if (idx === -1 || idx > posEnd) {
                break;
            }
            // Si está dentro del bloque mgmt, saltarlo
            if (idx > posOutStart && idx < posOutEnd) {
                searchFrom = idx + 1;
                continue;
            }
            pos = idx;
            break;
        }
        return this.adjustPosBeginLine(text, pos);
    }
    findPosOutsideExt(text, tag, posStart1, posEnd1, posStart2, posEnd2) {
        let pos = -1;
        let searchFrom = 0;
        while (true) {
            const idx = text.indexOf(tag, searchFrom);
            if (idx === -1) {
                break;
            }
            // Si está dentro del bloque mgmt, saltarlo
            if ((idx > posStart1 && idx < posEnd1) ||
                (idx > posStart2 && idx < posEnd2)) {
                searchFrom = idx + 1;
                continue;
            }
            pos = idx;
            break;
        }
        return this.adjustPosBeginLine(text, pos);
    }
    findPosBehind(text, tags) {
        let maxPos = -1;
        for (const tag of tags) {
            const idx = text.indexOf(tag);
            if (idx !== -1) {
                const pos = idx + tag.length;
                if (pos > maxPos) {
                    maxPos = pos;
                }
            }
        }
        return this.adjustPosBeginLine(text, maxPos);
    }
    adjustPosBeginLine(text, pos) {
        if (pos === -1) {
            return pos;
        }
        while (pos > 0 && text.charAt(pos - 1) != '>' && text.charAt(pos - 1) != '\n') {
            pos = pos - 1;
        }
        return pos;
    }
    adjustPosNextLine(text, pos) {
        if (pos === -1) {
            return pos;
        }
        while (pos < text.length && text.charAt(pos + 1) != '<' && text.charAt(pos + 1) != '\n') {
            pos = pos + 1;
        }
        if (text.charAt(pos) == '\n' && pos < text.length) {
            pos = pos + 1;
        }
        return pos;
    }
}
exports.PomTextStatus = PomTextStatus;
//# sourceMappingURL=PomTextStatus.js.map