"""
Analytics data source configuration.

Environment:
  TASKFLOW_ANALYTICS_SOURCE — "demo" (default) or "databricks"

When source is databricks:
  DATABRICKS_SERVER_HOSTNAME — workspace host (no https://)
  DATABRICKS_HTTP_PATH — SQL warehouse HTTP path, e.g. /sql/1.0/warehouses/...
  DATABRICKS_TOKEN — personal access token
  DATABRICKS_CATALOG — default main
  DATABRICKS_SCHEMA — default taskflow_analytics
  DATABRICKS_TASKS_TABLE — default tasks_fact (Unity Catalog table or view)

Expected columns on the tasks table/view:
  cohort_segment STRING — matches UI cohort slugs (all is handled in SQL, not stored)
  category STRING
  priority STRING — high | medium | low
  status STRING — todo | in-progress | done
  created_at TIMESTAMP
  completed_at TIMESTAMP — nullable until done
"""

import os
import re

VALID_ANALYTICS_COHORTS = frozenset(
    {"all", "power_users", "new_users", "enterprise", "team_alpha", "team_beta"}
)

_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _valid_ident(name):
    return bool(name and _IDENT.match(name))


def get_analytics_source():
    return (os.environ.get("TASKFLOW_ANALYTICS_SOURCE") or "demo").strip().lower()


def use_databricks_analytics():
    return get_analytics_source() == "databricks"


def databricks_connection_params():
    return {
        "server_hostname": (os.environ.get("DATABRICKS_SERVER_HOSTNAME") or "").strip(),
        "http_path": (os.environ.get("DATABRICKS_HTTP_PATH") or "").strip(),
        "access_token": (os.environ.get("DATABRICKS_TOKEN") or "").strip(),
    }


def databricks_tasks_table_parts():
    catalog = (os.environ.get("DATABRICKS_CATALOG") or "main").strip()
    schema = (os.environ.get("DATABRICKS_SCHEMA") or "taskflow_analytics").strip()
    table = (os.environ.get("DATABRICKS_TASKS_TABLE") or "tasks_fact").strip()
    if not (_valid_ident(catalog) and _valid_ident(schema) and _valid_ident(table)):
        raise ValueError(
            "DATABRICKS_CATALOG, DATABRICKS_SCHEMA, and DATABRICKS_TASKS_TABLE must be alphanumeric/underscore identifiers"
        )
    return catalog, schema, table


def databricks_tasks_table_sql():
    """Safe backticked three-part name for Databricks SQL."""
    catalog, schema, table = databricks_tasks_table_parts()
    return f"`{catalog}`.`{schema}`.`{table}`"


def databricks_config_ok():
    if not use_databricks_analytics():
        return True
    p = databricks_connection_params()
    if not p["server_hostname"] or not p["http_path"] or not p["access_token"]:
        return False
    try:
        databricks_tasks_table_parts()
    except ValueError:
        return False
    return True
