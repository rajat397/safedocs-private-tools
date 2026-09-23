package com.planly.common;

import com.planly.draft.DraftStore;
import com.planly.gen.OpStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Cron jobs: daily warmup (keeps Supabase off the 7d-inactivity pause),
 * nightly draft purge (30d TTL), hourly op-TTL purge (24h, 410 then DELETE).
 * Separate @Configuration so MVC slice tests never start the scheduler.
 */
@Configuration
@EnableScheduling
public class PlanlyScheduling {

  private static final Logger log = LoggerFactory.getLogger(PlanlyScheduling.class);

  @Scheduled(cron = "0 30 3 * * *")
  public void warmup() {
    WarmupState.markWarm();
    log.info("cron warmup ok");
  }

  @Scheduled(cron = "0 15 4 * * *")
  public void purgeDrafts() {
    int removed = DraftStore.purgeOlderThan(System.currentTimeMillis() - 30L * 24 * 3600 * 1000);
    log.info("cron draft purge ok removed={}", removed);
  }

  @Scheduled(cron = "0 0 * * * *")
  public void purgeOps() {
    int removed = OpStore.purgeExpired(System.currentTimeMillis());
    log.info("cron op-ttl purge ok removed={}", removed);
  }
}
