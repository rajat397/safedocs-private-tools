package com.planly.db;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Comparator;
import java.util.List;

import javax.sql.DataSource;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfoService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * No-Docker lane: proves Flyway V1..V4 migrate cleanly on an embedded
 * (user-space, Zonky) Postgres instead of Testcontainers.
 *
 * <p>Heavy dirs stay on HDD: the PG cluster lives under
 * {@code $PLANLY_PGDATA/flyway-embedded} (falls back to
 * {@code java.io.tmpdir}, which the env script points at
 * {@code /mnt/data/planly/tmp}), so the 93%-full root disk is untouched.
 * Binary extraction likewise honours {@code TMPDIR}.
 *
 * <p>No secrets: embedded superuser is local-only and ephemeral.
 */
class FlywayMigrateEmbeddedIT {

  private static EmbeddedPostgres postgres;
  private static DataSource dataSource;

  @BeforeAll
  static void startEmbeddedPostgres() throws Exception {
    Path dataDir = dataDir();
    if (Files.exists(dataDir)) {
      try (var walk = Files.walk(dataDir)) {
        walk.sorted(Comparator.reverseOrder())
            .forEach(path -> path.toFile().delete());
      }
    }
    Files.createDirectories(dataDir.getParent());

    postgres = EmbeddedPostgres.builder()
        .setDataDirectory(dataDir)
        .start();
    dataSource = postgres.getPostgresDatabase();

    // Mirror of src/test/resources/postgres-init.sql (container init script):
    // V1 references auth.users + app_role/anon/authenticated, none of which
    // exist on a vanilla cluster. pgcrypto provides gen_random_uuid().
    try (Connection connection = dataSource.getConnection();
        Statement statement = connection.createStatement()) {
      statement.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto");
      statement.execute(
          "DO $$ BEGIN "
              + "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN "
              + "CREATE ROLE app_role WITH LOGIN; END IF; "
              + "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN "
              + "CREATE ROLE anon WITH LOGIN; END IF; "
              + "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN "
              + "CREATE ROLE authenticated WITH LOGIN; END IF; "
              + "END $$");
      statement.execute("CREATE SCHEMA IF NOT EXISTS auth");
      statement.execute(
          "CREATE TABLE IF NOT EXISTS auth.users ("
              + "id uuid PRIMARY KEY DEFAULT gen_random_uuid())");
    }

    Flyway.configure()
        .dataSource(dataSource)
        .locations("classpath:db/migration")
        .load()
        .migrate();
  }

  @AfterAll
  static void stopEmbeddedPostgres() throws Exception {
    if (postgres != null) {
      postgres.close();
    }
  }

  private static Path dataDir() {
    String base = System.getenv("PLANLY_PGDATA");
    if (base == null || base.isBlank()) {
      base = System.getProperty("java.io.tmpdir") + "/planly-pgdata";
    }
    return Paths.get(base, "flyway-embedded");
  }

  @Test
  void flywayAppliesV1ThroughV5Successfully() {
    JdbcTemplate jdbc = new JdbcTemplate(dataSource);

    List<String> applied =
        jdbc.queryForList(
            "SELECT version FROM flyway_schema_history WHERE success = true ORDER BY installed_rank",
            String.class);
    assertThat(applied).containsExactly("1", "2", "3", "4", "5");
  }

  @Test
  void schemaTablesExist() {
    JdbcTemplate jdbc = new JdbcTemplate(dataSource);

    List<String> tables =
        jdbc.queryForList(
            "SELECT table_name FROM information_schema.tables "
                + "WHERE table_schema = 'public' AND table_name IN "
                + "('drafts','steps','identity_links','operations','entitlements','plans','readjustments','plan_tracks','plan_dailies','plan_progress')",
            String.class);
    assertThat(tables)
        .containsExactlyInAnyOrder(
            "drafts",
            "steps",
            "identity_links",
            "operations",
            "entitlements",
            "plans",
            "readjustments",
            "plan_tracks",
            "plan_dailies",
            "plan_progress");
  }

  @Test
  void flywayReportsNoPendingMigrations() {
    MigrationInfoService info = Flyway.configure()
        .dataSource(dataSource)
        .locations("classpath:db/migration")
        .load()
        .info();
    assertThat(info.pending()).isEmpty();
  }
}
