"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_DEPS = void 0;
// Well-known dependencies by category for quick-pick
exports.KNOWN_DEPS = [
    { label: '[ Custom dependency... ]', detail: 'Enter groupId:artifactId:version manually', groupId: '', artifactId: '', version: '' },
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
    // Python / Jython
    { label: 'Jython', detail: 'Python interpreter for JVM', groupId: 'org.python', artifactId: 'jython-standalone', version: '2.7.3' },
    // Utilities
    { label: 'Apache Commons Lang', detail: 'Utility methods', groupId: 'org.apache.commons', artifactId: 'commons-lang3', version: '3.14.0' },
    { label: 'Guava', detail: 'Google core libraries', groupId: 'com.google.guava', artifactId: 'guava', version: '33.0.0-jre' },
    { label: 'Lombok', detail: 'Boilerplate reduction annotations', groupId: 'org.projectlombok', artifactId: 'lombok', version: '1.18.30', scope: 'provided' },
];
//# sourceMappingURL=KnownDependencies.js.map