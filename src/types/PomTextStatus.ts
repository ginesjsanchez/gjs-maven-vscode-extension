
// TODO: Completar toda la información

export class PomTextStatus {
		hasParent: boolean = false;
		hasProperties: boolean = false;
		hasModules: boolean = false;
		hasManagedDependencies: boolean = false;
		hasMDDependencies: boolean = false;
		hasDependencies: boolean = false;
		hasBuild: boolean = false;
		hasManagedPlugins: boolean = false;
		hasMPPlugins: boolean = false;
		hasPlugins: boolean = false;
		hasProfiles: boolean = false;
		hasReporting : boolean = false;
		
		parentStart : number = -1;
		parentEnd : number = -1;
		propertiesStart : number = -1;
		propertiesEnd : number = -1;
		modulesStart : number = -1;
		modulesEnd : number = -1;
		managedDependenciesStart : number = -1;
		managedDependenciesEnd : number = -1;
		mdDependenciesStart : number = -1;
		mdDependenciesEnd : number = -1;
		dependenciesStart : number = -1;
		dependenciesEnd : number = -1;
		buildStart : number = -1;
		buildEnd : number = -1;
		managedPluginsStart : number = -1;
		managedPluginsEnd : number = -1;
		mpPluginsStart : number = -1;
		mpPluginsEnd : number = -1;
		pluginsStart : number = -1;
		pluginsEnd : number = -1;
		profilesStart : number = -1;
		profilesEnd : number = -1;
		reportingStart : number = -1;
		reportingEnd : number = -1;
		
		postHeader : number = -1;
		postManagedDependencies : number = -1;
		postDependencies : number = -1;
		postBuild : number = -1;

    constructor(text: string) {
		if ( text ) {
			this.parentStart = this.adjustPosBeginLine(text, text.indexOf('<parent>'));
			this.hasParent = this.parentStart !== -1;
			this.parentEnd = this.adjustPosBeginLine(text, text.indexOf('</parent>'));
			
			this.profilesStart = this.adjustPosBeginLine(text, text.indexOf('<profiles>'));
			this.hasProfiles = this.profilesStart !== -1;
			this.profilesEnd  = this.adjustPosBeginLine(text, text.indexOf('</profiles>'));
			if ( this.hasProfiles ) {
				this.propertiesStart = this.findPosOutside(text, '<properties>', this.profilesStart, this.profilesEnd);
			} else {
				this.propertiesStart = this.adjustPosBeginLine(text, text.indexOf('<properties>'));
			}
			this.hasProperties = this.propertiesStart !== -1;
			if ( this.hasProperties ) {
				this.propertiesEnd = this.adjustPosBeginLine(text, text.indexOf('</properties>', this.propertiesStart));
			}
			if ( this.hasProfiles ) {
				this.modulesStart = this.findPosOutside(text, '<modules>', this.profilesStart, this.profilesEnd);
			} else {
				this.modulesStart = this.adjustPosBeginLine(text, text.indexOf('<modules>'));
			}
			this.hasModules = this.modulesStart !== -1;
			if ( this.hasProperties ) {
				this.modulesEnd  = this.adjustPosBeginLine(text, text.indexOf('</modules>', this.modulesStart));
			}
			if ( this.hasProfiles ) {
				this.managedDependenciesStart = this.findPosOutside(text, '<dependencyManagement>', this.profilesStart, this.profilesEnd);
			} else {
				this.managedDependenciesStart = text.indexOf('<dependencyManagement>');
			}
			this.hasManagedDependencies = this.managedDependenciesStart !== -1;
			if ( this.hasManagedDependencies ) {
				this.managedDependenciesEnd  = this.adjustPosBeginLine(text, text.indexOf('</dependencyManagement>', this.managedDependenciesStart));
				this.mdDependenciesStart = this.findPosInside(text, '<dependencies>', this.managedDependenciesStart, this.managedDependenciesEnd);
				this.hasMDDependencies = this.mdDependenciesStart !== -1;
				if ( this.hasMDDependencies ) {
					this.mdDependenciesEnd  = this.adjustPosBeginLine(text, text.indexOf('</dependencies>', this.mdDependenciesStart));
				}
			}
			if ( this.hasManagedDependencies && this.hasProfiles ) {
				this.dependenciesStart = this.findPosOutsideExt(text, '<dependencies>', this.managedDependenciesStart, this.managedDependenciesEnd, this.profilesStart, this.profilesEnd);
			} else if ( this.hasManagedDependencies ) {
				this.dependenciesStart = this.findPosOutside(text, '<dependencies>', this.managedDependenciesStart, this.managedDependenciesEnd);
			} else if ( this.hasProfiles ) {
				this.dependenciesStart = this.findPosOutside(text, '<dependencies>', this.profilesStart, this.profilesEnd);
			} else {
				this.dependenciesStart = this.adjustPosBeginLine(text, text.indexOf('<dependencies>'));
			}
			this.hasDependencies = this.dependenciesStart !== -1;
			if ( this.hasDependencies ) {
				this.dependenciesEnd = this.adjustPosBeginLine(text, text.indexOf('</dependencies>', this.dependenciesStart));
			}
			if ( this.hasProfiles ) {
				this.buildStart = this.findPosOutside(text, '<build>', this.profilesStart, this.profilesEnd);
			} else {
				this.buildStart = this.adjustPosBeginLine(text, text.indexOf('<build>'));
			}
			this.hasBuild = this.buildStart !== -1;
			if ( this.hasBuild ) {
				this.buildEnd  = this.adjustPosBeginLine(text, text.indexOf('</build>', this.buildStart));
				this.managedPluginsStart = this.findPosInside(text, '<pluginManagement>', this.buildStart, this.buildEnd);
				this.hasManagedPlugins = this.managedPluginsStart !== -1;
				if ( this.hasManagedPlugins ) {
					this.managedPluginsEnd  = this.findPosInside(text, '</pluginManagement>', this.managedPluginsStart, this.buildEnd);
					this.mpPluginsStart = this.findPosInside(text, '<plugins>', this.managedPluginsStart, this.managedPluginsEnd);
					this.hasMPPlugins = this.mpPluginsStart !== -1;
					if ( this.hasMPPlugins ) {
						this.mpPluginsEnd  = this.adjustPosBeginLine(text, text.indexOf('</plugins>', this.mpPluginsStart));
					}
					this.pluginsStart = this.findPosInsideOutside(text, '<plugins>', this.buildStart, this.buildEnd, this.managedPluginsStart, this.managedPluginsEnd);
				} else {
					this.pluginsStart = this.findPosInside(text, '<plugins>', this.buildStart, this.buildEnd);
				}
				this.hasPlugins = this.pluginsStart !== -1;
				if (this.hasPlugins) {
					this.pluginsEnd = this.adjustPosBeginLine(text, text.indexOf('</plugins>', this.pluginsStart));
				}
			}
			if ( this.hasProfiles ) {
				this.reportingStart = this.findPosOutside(text, '<reporting>', this.profilesStart, this.profilesEnd);
			} else {
				this.reportingStart = this.adjustPosBeginLine(text, text.indexOf('<reporting>'));
			}
			this.hasReporting = this.reportingStart !== -1;
			if ( this.hasReporting ) {
				this.reportingEnd = this.adjustPosBeginLine(text, text.indexOf('</reporting>', this.reportingStart));
			}
			
			this.postHeader = this.findPosBehind(text, 
				[ '</properties>', '</ciManagement>', '</issueManagement>', '</scm>', '</mailingLists>',
				  '</contributors>', '</developers>', '</licenses>', '</organization>', '</inceptionYear>', 
				  '</url>', '</description>', '</name>', '</packaging>', '</version>', '<artifactId>',
				  '</groupId>', '</parent>' ]);
			this.postManagedDependencies = Math.max( this.postHeader, this.adjustPosNextLine(text, this.managedDependenciesEnd));
			this.postDependencies = Math.max( this.postManagedDependencies, this.adjustPosNextLine(text, this.dependenciesEnd));
			this.postBuild = Math.max( this.postDependencies, this.adjustPosNextLine(text, this.buildEnd));
		}
	}
		
	private findPosOutside(text: string, tag: string, posStart: number, posEnd: number) : number {
		let pos = -1;
		let searchFrom = 0;
		while (true) {
			const idx = text.indexOf(tag, searchFrom);
			if (idx === -1) { break; }
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
	
	private findPosInside(text: string, tag: string, posStart: number, posEnd: number) : number {
		let pos = -1;
		const idx = text.indexOf(tag, posStart);
		if (idx > posStart && idx < posEnd) { 
			pos = idx;
		}
		return this.adjustPosBeginLine(text, pos);	
	}

	private findPosInsideOutside(text: string, tag: string, posStart: number, posEnd: number, posOutStart: number, posOutEnd: number) : number {
		let pos = -1;
		let searchFrom = posStart;
		while (true) {
			const idx = text.indexOf(tag, searchFrom);
			if (idx === -1 || idx > posEnd ) { break; }
			// Si está dentro del bloque mgmt, saltarlo
			if ( idx > posOutStart && idx < posOutEnd ) {
				searchFrom = idx + 1;
				continue;
			}
			pos = idx;
			break;
		}
		return this.adjustPosBeginLine(text, pos);	
	}

	private findPosOutsideExt(text: string, tag: string, posStart1: number, posEnd1: number, posStart2: number, posEnd2: number) : number {
		let pos = -1;
		let searchFrom = 0;
		while (true) {
			const idx = text.indexOf(tag, searchFrom);
			if (idx === -1) { break; }
			// Si está dentro del bloque mgmt, saltarlo
			if ( ( idx > posStart1 && idx < posEnd1 ) || 
				( idx > posStart2 && idx < posEnd2 ) ) {
				searchFrom = idx + 1;
				continue;
			}
			pos = idx;
			break;
		}
		return this.adjustPosBeginLine(text, pos);	
	}
	
	private findPosBehind(text: string, tags: string []) : number {
		let maxPos = -1;
		for (const tag of tags) {
			const idx = text.indexOf(tag);
			if (idx !== -1) {
				const pos = idx + tag.length;
				if (pos > maxPos) { maxPos = pos; }
			}
		}
		return this.adjustPosBeginLine(text, maxPos);
	}

	private adjustPosBeginLine(text: string, pos: number) : number {
		if (pos === -1 ) {
			return pos;
		}
		while ( pos > 0 && text.charAt(pos-1) != '>' && text.charAt(pos-1) != '\n' ) {
			pos = pos - 1;
		}
		return pos;
	}

	private adjustPosNextLine(text: string, pos: number) : number {
		if (pos === -1 ) {
			return pos;
		}
		while ( pos < text.length && text.charAt(pos+1) != '<' && text.charAt(pos+1) != '\n' ) {
			pos = pos + 1;
		}
		if (text.charAt(pos) == '\n' &&  pos < text.length ) {
			pos = pos + 1;
		}	
		return pos;
	}
	
}