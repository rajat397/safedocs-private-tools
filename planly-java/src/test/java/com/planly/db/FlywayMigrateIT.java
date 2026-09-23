package com.planly.db;

import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.EnabledIfDockerAvailable;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 2: proves Flyway V1..V4 migrate cleanly on postgres:16-alpine.
 *
 * <p>JDBC is dynamic via {@code @ServiceConnection} — no hardcoded secrets.
 * The container init script ({@code postgres-init.sql}) pre-creates
 * {@code auth.users} + {@code app_role}/{@code anon}/{@code authenticated},
 * which V1 references but vanilla postgres lacks.
 *
 * <p>Docker lane: skipped automatically when no Docker daemon is reachable
 * (this box has a root-owned socket and no rootless binaries). The no-Docker
 * lane is {@link FlywayMigrateEmbeddedIT} (Zonky embedded Postgres).
 */
@EnabledIfDockerAvailable
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class FlywayMigrateIT {

  @Container
  @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:16-alpine").withInitScript("postgres-init.sql");

  @Autowired
  private DataSource dataSource;

  @Test
  void flywayAppliesV1ThroughV4Successfully() {
    JdbcTemplate jdbc = new JdbcTemplate(dataSource);

    List<String> applied =
        jdbc.queryForList(
            "SELECT version FROM flyway_schema_history WHERE success = true ORDER BY installed_rank",
            String.class);
    assertThat(applied).containsExactly("1", "2", "3", "4");
  }

  @Test
  void schemaTablesExist() {
    JdbcTemplate jdbc = new JdbcTemplate(dataSource);

    List<String> tables =
        jdbc.queryForList(
            "SELECT table_name FROM information_schema.tables "
                + "WHERE table_schema = 'public' AND table_name IN "
                + "('drafts','steps','identity_links','operations','entitlements','plans','readjustments')",
            String.class);
    assertThat(tables)
        .containsExactlyInAnyOrder(
            "drafts",
            "steps",
            "identity_links",
            "operations",
            "entitlements",
            "plans",
            "readjustments");
  }
}
