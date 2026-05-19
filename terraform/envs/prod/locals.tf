# Shared values across multiple resources.

locals {
  sentry_dsn = "https://390e4e3ae6e27d230082cdbcb313b317@o4511365332729856.ingest.us.sentry.io/4511385621495808"

  observability_env = {
    SENTRY_DSN = local.sentry_dsn
    DEPLOY_ENV = "production"
    LOG_LEVEL  = "INFO"
  }
}