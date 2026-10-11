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
    rm -f "$BACKEND_PID_FILE"
    free_port "$BACKEND_PORT" || exit 1
    : > "$BACKEND_LOG_FILE"
    start_process "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE" env HOST=127.0.0.1 PORT="$BACKEND_PORT" CLIENT_ORIGIN="http://127.0.0.1:$FRONTEND_PORT" npm run dev:server
    wait_for_http "http://127.0.0.1:$BACKEND_PORT/api/health" 40 1 || {
      echo "backend failed to start"
      stop_process "$BACKEND_PID_FILE"
      exit 1
    }
    echo "backend started on $BACKEND_PORT (pid $(read_pid "$BACKEND_PID_FILE"))"
  fi

  if [ -f "$FRONTEND_PID_FILE" ] && is_pid_running "$(cat "$FRONTEND_PID_FILE")"; then
    echo "frontend already running"
  else
    rm -f "$FRONTEND_PID_FILE"
    free_port "$FRONTEND_PORT" || exit 1
    : > "$FRONTEND_LOG_FILE"
    start_process "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE" npm run dev:client
    wait_for_http "http://127.0.0.1:$FRONTEND_PORT" 40 1 || {
      echo "frontend failed to start"
      stop_process "$FRONTEND_PID_FILE"
      exit 1
    }
    echo "frontend started on $FRONTEND_PORT (pid $(read_pid "$FRONTEND_PID_FILE"))"
  fi

  echo "open http://127.0.0.1:$FRONTEND_PORT"
}

stop_all() {
  stop_process "$FRONTEND_PID_FILE"
  stop_process "$BACKEND_PID_FILE"
  # pid 文件丢失（或上次 stop 只杀了 npm 外壳）时的兜底：回收仍占着端口的遗留进程。
  free_port "$FRONTEND_PORT" || true
  free_port "$BACKEND_PORT" || true
  echo "stopped frontend and backend"
}

status_all() {
  frontend_pid="$(read_pid "$FRONTEND_PID_FILE" 2>/dev/null || true)"
  backend_pid="$(read_pid "$BACKEND_PID_FILE" 2>/dev/null || true)"

  if [ -n "$frontend_pid" ] && is_pid_running "$frontend_pid"; then
    echo "frontend: running (pid $frontend_pid, port $FRONTEND_PORT)"
  else
    echo "frontend: stopped"
    report_stray "$FRONTEND_PORT"
  fi

  if [ -n "$backend_pid" ] && is_pid_running "$backend_pid"; then
    echo "backend: running (pid $backend_pid, port $BACKEND_PORT)"
  else
    echo "backend: stopped"
    report_stray "$BACKEND_PORT"
  fi

  echo "frontend log: $FRONTEND_LOG_FILE"
  echo "backend log: $BACKEND_LOG_FILE"
}

# 没有对应 pid 文件、却仍占着端口的本项目进程 = 上次没被收干净的孤儿。
report_stray() {
  port="$1"
  for pid in $(port_pids "$port"); do
    if is_project_process "$pid"; then
      echo "  warning: stray project process $pid still holds port $port"
    else
      echo "  note: port $port is held by unrelated process $pid"
    fi
  done
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
