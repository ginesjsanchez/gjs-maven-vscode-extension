import * as tar from 'tar';
import * as fs from 'fs';
import * as path from 'path';

const AdmZip = require('adm-zip');

export async function unpackDependencies(dependencyPath : string, targetPath : string) {

    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });

    const files = fs.readdirSync(dependencyPath);

    for (const file of files) {
        const fullPath = path.join(dependencyPath, file);
        const destDir  = path.join(targetPath, stripExtensions(file));

        try {
            if      (isZipLike(file))   unpackZip(fullPath, destDir);
            else if (isTarLike(file))   await unpackTar(fullPath, destDir);
            else {
                // .so .a .dll .lib → copiar directamente a lib/
                const libDir = path.join(targetPath, 'lib');
                fs.mkdirSync(libDir, { recursive: true });
                fs.copyFileSync(fullPath, path.join(libDir, file));
            }
        } catch (e: any) {
            console.warn(`No se pudo desempaquetar ${file}: ${e.message}`);
        }
    }
}

//  Detección de tipo 

function isZipLike(file: string): boolean {
    return ['.nar', '.zip', '.jar', '.pyz'].some(ext => file.endsWith(ext));
}

function isTarLike(file: string): boolean {
    return ['.tar.gz', '.tgz', '.tar.bz2', '.tar.xz', '.tar'].some(ext => file.endsWith(ext));
}

//  Desempaquetadores 

function unpackZip(fullPath: string, destDir: string) {
    fs.mkdirSync(destDir, { recursive: true });
    const zip = new AdmZip(fullPath);
    zip.extractAllTo(destDir, true);
}

async function unpackTar(fullPath: string, destDir: string) {
    fs.mkdirSync(destDir, { recursive: true });
    await tar.extract({ file: fullPath, cwd: destDir });
}


//  Utilidad 

function stripExtensions(file: string): string {
    // Elimina extensiones compuestas como .tar.gz antes que path.basename
    return file
        .replace(/\.(tar\.gz|tar\.bz2|tar\.xz)$/, '')
        .replace(/\.[^.]+$/, '');
}