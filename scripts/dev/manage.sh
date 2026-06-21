#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

command_name="${1:-status}"

start_all() {
  ensure_runtime_dirs

  if [ -f "$BACKEND_PID_FILE" ] && is_pid_running "$(cat "$BACKEND_PID_FILE")"; then
    echo "backend already running"
  else
    if port_in_use "$BACKEND_PORT"; then
      echo "backend port $BACKEND_PORT already in use"
      exit 1
    fi
    : > "$BACKEND_LOG_FILE"
    start_process "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE" env HOST=127.0.0.1 PORT="$BACKEND_PORT" CLIENT_ORIGIN="http://127.0.0.1:$FRONTEND_PORT" npm run dev:server
    wait_for_http "http://127.0.0.1:$BACKEND_PORT/api/health" 40 1 || {
      echo "backend failed to start"
      exit 1
    }
    echo "backend started on $BACKEND_PORT"
  fi

  if [ -f "$FRONTEND_PID_FILE" ] && is_pid_running "$(cat "$FRONTEND_PID_FILE")"; then
    echo "frontend already running"
  else
    if port_in_use "$FRONTEND_PORT"; then
      echo "frontend port $FRONTEND_PORT already in use"
      exit 1
    fi
    : > "$FRONTEND_LOG_FILE"
    start_process "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE" npm run dev:client
    wait_for_http "http://127.0.0.1:$FRONTEND_PORT" 40 1 || {
      echo "frontend failed to start"
      exit 1
    }
    echo "frontend started on $FRONTEND_PORT"
  fi

  echo "open http://127.0.0.1:$FRONTEND_PORT"
}

stop_all() {
  stop_process "$FRONTEND_PID_FILE"
  stop_process "$BACKEND_PID_FILE"
  echo "stopped frontend and backend"
}

status_all() {
  frontend_pid="$(read_pid "$FRONTEND_PID_FILE" 2>/dev/null || true)"
  backend_pid="$(read_pid "$BACKEND_PID_FILE" 2>/dev/null || true)"

  if [ -n "$frontend_pid" ] && is_pid_running "$frontend_pid"; then
    echo "frontend: running (pid $frontend_pid, port $FRONTEND_PORT)"
  else
    echo "frontend: stopped"
  fi

  if [ -n "$backend_pid" ] && is_pid_running "$backend_pid"; then
    echo "backend: running (pid $backend_pid, port $BACKEND_PORT)"
  else
    echo "backend: stopped"
  fi

  echo "frontend log: $FRONTEND_LOG_FILE"
  echo "backend log: $BACKEND_LOG_FILE"
}

logs_all() {
  target="${2:-all}"
  case "$target" in
    frontend)
      tail -f "$FRONTEND_LOG_FILE"
      ;;
    backend)
      tail -f "$BACKEND_LOG_FILE"
      ;;
    *)
      tail -f "$FRONTEND_LOG_FILE" "$BACKEND_LOG_FILE"
      ;;
  esac
}

case "$command_name" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  logs)
    logs_all "$@"
    ;;
  *)
    echo "usage: sh scripts/dev/manage.sh {start|stop|restart|status|logs [frontend|backend|all]}"
    exit 1
    ;;
esac
