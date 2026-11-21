// Intentionally empty: each module declares its own plugins (with explicit
// versions from gradle/libs.versions.toml) so that running a task on one
// module - e.g. `./gradlew :core:test` - doesn't force Gradle to resolve
// plugins only needed by other modules (see gradle.properties, which turns
// on configure-on-demand for exactly this reason).
