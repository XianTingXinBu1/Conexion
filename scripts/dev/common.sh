#!/bin/sh

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
RUNTIME_DIR="$PROJECT_ROOT/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
FRONTEND_PORT="3100"
BACKEND_PORT="3900"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"
BACKEND_LOG_FILE="$LOG_DIR/backend.log"

ensure_runtime_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

read_pid() {
  file="$1"
  [ -f "$file" ] || return 1
  cat "$file"
}

is_pid_running() {
  pid="$1"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

port_in_use() {
  port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -E "[:.]$port$" >/dev/null 2>&1
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -E "[:.]$port$" >/dev/null 2>&1
    return $?
  fi

  return 1
}

wait_for_http() {
  url="$1"
  retries="${2:-40}"
  delay="${3:-1}"
  i=0
  while [ "$i" -lt "$retries" ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS "$url" >/dev/null 2>&1; then
        return 0
      fi
    fi
    i=$((i + 1))
    sleep "$delay"
  done
  return 1
}

start_process() {
  pid_file="$1"
  log_file="$2"
  shift 2
  nohup "$@" >>"$log_file" 2>&1 &
  echo $! > "$pid_file"
}

stop_process() {
  pid_file="$1"
  pid="$(read_pid "$pid_file" 2>/dev/null || true)"
  if [ -n "$pid" ] && is_pid_running "$pid"; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    if is_pid_running "$pid"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pid_file"
}
