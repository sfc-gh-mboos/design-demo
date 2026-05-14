"""Databricks SQL Warehouse access (Python connector; same endpoint as JDBC/ODBC)."""

from analytics_config import databricks_connection_params


class DatabricksQueryError(Exception):
    """Raised when a warehouse query fails or the driver errors."""


def connect():
    from databricks import sql

    p = databricks_connection_params()
    return sql.connect(
        server_hostname=p["server_hostname"],
        http_path=p["http_path"],
        access_token=p["access_token"],
    )


def run_query(sql_text, parameters=None):
    """
    Run a single SELECT, return list of row dicts (column names lowercased for stability).
    """
    params = parameters or ()
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql_text, params)
            if cur.description is None:
                return []
            raw_cols = [c[0] for c in cur.description]
            cols = [c.lower() if isinstance(c, str) else c for c in raw_cols]
            rows = cur.fetchall()
        return [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        raise DatabricksQueryError(str(e)) from e
    finally:
        conn.close()
