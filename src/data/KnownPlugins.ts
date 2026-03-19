export const KNOWN_PLUGS: { label: string; detail: string; groupId: string; artifactId: string; version?: string }[] = [
    { label: '[ Custom plugin... ]', detail: 'Enter groupId:artifactId:version manually', groupId: '', artifactId: '' },

    // ── Apache Maven Core Plugins ─────────────────────────────────────────────
    { label: 'maven-clean-plugin',        detail: 'Cleans the build directory',                         groupId: 'org.apache.maven.plugins', artifactId: 'maven-clean-plugin',             version: '3.3.2' },
    { label: 'maven-compiler-plugin',     detail: 'Compiles Java sources',                              groupId: 'org.apache.maven.plugins', artifactId: 'maven-compiler-plugin',          version: '3.13.0' },
    { label: 'maven-deploy-plugin',       detail: 'Deploys artifact to remote repository',              groupId: 'org.apache.maven.plugins', artifactId: 'maven-deploy-plugin',            version: '3.1.2' },
    { label: 'maven-install-plugin',      detail: 'Installs artifact to local repository',              groupId: 'org.apache.maven.plugins', artifactId: 'maven-install-plugin',           version: '3.1.2' },
    { label: 'maven-jar-plugin',          detail: 'Builds JAR files',                                   groupId: 'org.apache.maven.plugins', artifactId: 'maven-jar-plugin',               version: '3.4.1' },
    { label: 'maven-war-plugin',          detail: 'Builds WAR files',                                   groupId: 'org.apache.maven.plugins', artifactId: 'maven-war-plugin',               version: '3.4.0' },
    { label: 'maven-ear-plugin',          detail: 'Builds EAR files',                                   groupId: 'org.apache.maven.plugins', artifactId: 'maven-ear-plugin',               version: '3.3.0' },
    { label: 'maven-rar-plugin',          detail: 'Builds RAR files',                                   groupId: 'org.apache.maven.plugins', artifactId: 'maven-rar-plugin',               version: '3.0.0' },
    { label: 'maven-resources-plugin',    detail: 'Handles project resources',                          groupId: 'org.apache.maven.plugins', artifactId: 'maven-resources-plugin',         version: '3.3.1' },
    { label: 'maven-surefire-plugin',     detail: 'Runs unit tests',                                    groupId: 'org.apache.maven.plugins', artifactId: 'maven-surefire-plugin',          version: '3.2.5' },
    { label: 'maven-failsafe-plugin',     detail: 'Runs integration tests',                             groupId: 'org.apache.maven.plugins', artifactId: 'maven-failsafe-plugin',          version: '3.2.5' },
    { label: 'maven-site-plugin',         detail: 'Generates project site documentation',               groupId: 'org.apache.maven.plugins', artifactId: 'maven-site-plugin',              version: '4.0.0-M13' },
    { label: 'maven-source-plugin',       detail: 'Creates source JAR',                                 groupId: 'org.apache.maven.plugins', artifactId: 'maven-source-plugin',            version: '3.3.1' },
    { label: 'maven-javadoc-plugin',      detail: 'Generates Javadoc',                                  groupId: 'org.apache.maven.plugins', artifactId: 'maven-javadoc-plugin',           version: '3.7.0' },
    { label: 'maven-assembly-plugin',     detail: 'Creates distribution archives',                      groupId: 'org.apache.maven.plugins', artifactId: 'maven-assembly-plugin',          version: '3.7.1' },
    { label: 'maven-dependency-plugin',   detail: 'Dependency analysis and manipulation',               groupId: 'org.apache.maven.plugins', artifactId: 'maven-dependency-plugin',        version: '3.7.0' },
    { label: 'maven-shade-plugin',        detail: 'Creates uber-JAR with relocated classes',            groupId: 'org.apache.maven.plugins', artifactId: 'maven-shade-plugin',             version: '3.6.0' },
    { label: 'maven-antrun-plugin',       detail: 'Runs Ant tasks from Maven',                          groupId: 'org.apache.maven.plugins', artifactId: 'maven-antrun-plugin',            version: '3.1.0' },
    { label: 'maven-enforcer-plugin',     detail: 'Enforces rules on the build environment',            groupId: 'org.apache.maven.plugins', artifactId: 'maven-enforcer-plugin',          version: '3.5.0' },
    { label: 'maven-release-plugin',      detail: 'Automates release process',                          groupId: 'org.apache.maven.plugins', artifactId: 'maven-release-plugin',           version: '3.1.0' },
    { label: 'maven-gpg-plugin',          detail: 'Signs artifacts with GPG',                           groupId: 'org.apache.maven.plugins', artifactId: 'maven-gpg-plugin',               version: '3.2.4' },
    { label: 'maven-checkstyle-plugin',   detail: 'Checks code style',                                  groupId: 'org.apache.maven.plugins', artifactId: 'maven-checkstyle-plugin',        version: '3.4.0' },
    { label: 'maven-pmd-plugin',          detail: 'PMD static code analysis',                           groupId: 'org.apache.maven.plugins', artifactId: 'maven-pmd-plugin',               version: '3.23.0' },

    // ── Codehaus Mojo ─────────────────────────────────────────────────────────
    { label: 'versions-maven-plugin',     detail: 'Manages versions of artifacts',                      groupId: 'org.codehaus.mojo',        artifactId: 'versions-maven-plugin',          version: '2.16.2' },
    { label: 'exec-maven-plugin',         detail: 'Executes programs and Java classes',                 groupId: 'org.codehaus.mojo',        artifactId: 'exec-maven-plugin',              version: '3.3.0' },
    { label: 'build-helper-maven-plugin', detail: 'Attaches extra artifacts and sources',               groupId: 'org.codehaus.mojo',        artifactId: 'build-helper-maven-plugin',      version: '3.6.0' },
    { label: 'flatten-maven-plugin',      detail: 'Flattens pom.xml for distribution',                  groupId: 'org.codehaus.mojo',        artifactId: 'flatten-maven-plugin',           version: '1.6.0' },

    // ── Quality ───────────────────────────────────────────────────────────────
    { label: 'spotbugs-maven-plugin',     detail: 'SpotBugs static analysis',                           groupId: 'com.github.spotbugs',      artifactId: 'spotbugs-maven-plugin',          version: '4.8.5.0' },
    { label: 'jacoco-maven-plugin',       detail: 'Code coverage with JaCoCo',                          groupId: 'org.jacoco',               artifactId: 'jacoco-maven-plugin',            version: '0.8.12' },

    // ── Groovy / GMaven ──────────────────────────────────────────────────────
    { label: 'gmavenplus-plugin',         detail: 'Compiles and runs Groovy code',                      groupId: 'org.codehaus.gmavenplus',  artifactId: 'gmavenplus-plugin',              version: '3.0.2' },

    // ── Ant ───────────────────────────────────────────────────────────────────
    { label: 'maven-antrun-plugin',       detail: 'Runs Ant tasks from Maven',                          groupId: 'org.apache.maven.plugins', artifactId: 'maven-antrun-plugin',            version: '3.1.0' },

    // ── Spring Boot ───────────────────────────────────────────────────────────
    { label: 'spring-boot-maven-plugin',  detail: 'Packages and runs Spring Boot applications',         groupId: 'org.springframework.boot', artifactId: 'spring-boot-maven-plugin',       version: '3.3.1' },

    // ── OpenAPI ───────────────────────────────────────────────────────────────
    { label: 'openapi-generator-plugin',  detail: 'Generates code from OpenAPI specs',                  groupId: 'org.openapitools',         artifactId: 'openapi-generator-maven-plugin', version: '7.7.0' },

    // ── C++ / NAR ─────────────────────────────────────────────────────────────
    { label: 'NAR Maven Plugin (C/C++)',  detail: 'Native code build support',                          groupId: 'com.github.maven-nar',     artifactId: 'nar-maven-plugin',               version: '3.10.1' },
];
