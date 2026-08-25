import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { unpackDependencies } from '../utils/Unpack'
import { MavenProjectContext } from '../context/MavenProjectContext';

/**
 * El equivalente al "Maven Update" de Eclipse: pone al día lo que el proyecto
 * necesita para que el IDE lo entienda, sin compilarlo.
 *
 * Según el lenguaje del módulo:
 *  - Java y demás: copia y desempaqueta las dependencias.
 *  - C/C++: refresca las librerías nativas y recalcula el includePath. Los
 *    goals del nar-maven-plugin que hacen ambas cosas (nar-download,
 *    nar-unpack y nar-include-path) están atados a fases anteriores a compile,
 *    así que se llega hasta process-sources y ni un paso más: el objetivo es
 *    poder entender un proyecto que todavía no compila.
 */
export class MavenUpdateCommand {

    constructor(
		private runner: import('./MavenCommandRunner').MavenCommandRunner
    ) {}


	async execute(targetPomUri: vscode.Uri): Promise<void> {

		const channel = MavenUpdateCommand.getOutputChannel();
		try {
			const projectDir = path.dirname(targetPomUri.fsPath);

			// PASO 0: Ver el lenguaje (resuelto y cacheado por el contexto)
			const language = await MavenProjectContext.getLanguage(projectDir);
			channel.appendLine(`🔍 language = '${language ?? '<sin definir>'}'`);

			if ( language === 'c' || language === 'c++' ) {
				channel.appendLine("⏳ Refrescando librerías nativas y recalculando el includePath...");
				await this.runner.runAndWait( 'process-sources', projectDir, channel );
				// El c_cpp_properties.json generado lo recoge CppPropertiesManager,
				// que vigila el fichero.
			} else {
				channel.appendLine("⏳ Resolviendo dependencias Maven...");
				const cmdCopy = `dependency:copy-dependencies -DincludeTypes="jar,zip,tgz,gz,pyz"`;
				const cmdUnpack = `dependency:unpack-dependencies -DincludeTypes="jar,zip,tgz,gz,pyz" -DoutputDirectory=target/unpacked`;

				// PASO 1: Resolver dependencias con Maven
				await this.runner.runAndWait( cmdCopy, projectDir, channel );

				// PASO 2: Desempaquetar headers (zips con includes)
				channel.appendLine("📦 Desempaquetando dependencias...");
				await this.runner.run( cmdUnpack, projectDir );
			}

			channel.appendLine("✅ Maven Update completado.");
			vscode.window.showInformationMessage("Maven Update: dependencias actualizadas.");

		} catch (err: any) {
			channel.appendLine(`❌ Error: ${err.message}`);
			vscode.window.showErrorMessage(`Maven Update falló: ${err.message}`);
		}
	}

	async resolveIncludePaths(projectDir: string): Promise<string[]> {
		const paths: string[] = [];
		const includesDir = path.join(projectDir, 'target', 'includes');

		if (!fs.existsSync(includesDir)) return paths;

		function walk(dir: string) {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const fullPath = path.join(dir, entry.name);
				if (entry.name === 'include') {
					paths.push(fullPath);  // la encontramos, no seguimos bajando
				} else {
					walk(fullPath);        // seguir buscando más abajo
				}
			}
		}

		walk(includesDir);
		return paths;
	}	
	
    private static _channel: vscode.OutputChannel | undefined;
    private static getOutputChannel(): vscode.OutputChannel {
        if (!MavenUpdateCommand._channel) {
            MavenUpdateCommand._channel = vscode.window.createOutputChannel('MavenUpdateCommand');
			MavenUpdateCommand._channel.show(true);
        }
        return MavenUpdateCommand._channel;
    }

}