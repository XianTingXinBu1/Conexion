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

# 进程组 id；进程已退出时输出为空。
process_group_of() {
  ps -o pgid= -p "$1" 2>/dev/null | tr -d ' '
}

# 递归收集某进程的全部后代 pid。
descendant_pids() {
  parent="$1"
  children="$(ps -o pid= --ppid "$parent" 2>/dev/null | tr -d ' ')"
  for child in $children; do
    descendant_pids "$child"
  done
  [ -n "$children" ] && echo "$children"
  return 0
}

# 优雅停止一棵进程树。
#
# 关键点：npm run dev:* 会派生 sh → node（tsx / vite）→ esbuild 多层子进程。
# 只 kill npm 那个 pid 时，子进程会被 reparent 到 init 继续占着端口。
# 因此优先整组终止（start_process 用 setsid 保证了组 id == 主 pid）；
# 对老脚本启动的、与 shell 共用进程组的进程则退化为逐个收子进程。
terminate_tree() {
  pid="$1"
  is_pid_running "$pid" || return 0

  pgid="$(process_group_of "$pid")"
  if [ -n "$pgid" ] && [ "$pgid" = "$pid" ]; then
    kill -TERM "-$pgid" 2>/dev/null || true
  else
    for child in $(descendant_pids "$pid"); do
      kill -TERM "$child" 2>/dev/null || true
    done
    kill -TERM "$pid" 2>/dev/null || true
  fi

  i=0
  while [ "$i" -lt 50 ] && is_pid_running "$pid"; do
    i=$((i + 1))
    sleep 0.2
  done

  if is_pid_running "$pid"; then
    if [ -n "$pgid" ] && [ "$pgid" = "$pid" ]; then
      kill -KILL "-$pgid" 2>/dev/null || true
    else
      for child in $(descendant_pids "$pid"); do
        kill -KILL "$child" 2>/dev/null || true
      done
      kill -KILL "$pid" 2>/dev/null || true
    fi
    sleep 0.5
  fi

  return 0
}

# 监听指定端口的 pid 列表。
port_pids() {
  port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$port" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -E "[:.]$port " | grep -oE 'pid=[0-9]+' | cut -d= -f2 || true
  fi
  return 0
}

port_in_use() {
  port="$1"
  if [ -n "$(port_pids "$port")" ]; then
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -E "[:.]$port$" >/dev/null 2>&1 && return 0
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -E "[:.]$port$" >/dev/null 2>&1 && return 0
  fi
  return 1
}

# 判断进程是否属于本项目：cwd 指向仓库根，或命令行里带仓库路径。
# 用于避免误杀别人的进程（比如同样占着 3100 的其它服务）。
is_project_process() {
  pid="$1"
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
  [ -n "$cwd" ] && [ "$cwd" = "$PROJECT_ROOT" ] && return 0
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  case "$cmdline" in
    *"$PROJECT_ROOT"*) return 0 ;;
  esac
  return 1
}

# 回收端口：只清理本项目遗留进程；被无关进程占用时返回 1。
free_port() {
  port="$1"
  pids="$(port_pids "$port")"
  [ -n "$pids" ] || return 0

  for pid in $pids; do
    if ! is_project_process "$pid"; then
      echo "port $port is held by unrelated process $pid ($(ps -o comm= -p "$pid" 2>/dev/null))" >&2
      return 1
    fi
    echo "reclaiming port $port from stale project process $pid"
    terminate_tree "$pid"
  done

  i=0
  while [ "$i" -lt 25 ] && port_in_use "$port"; do
    i=$((i + 1))
    sleep 0.2
  done

  if port_in_use "$port"; then
    echo "port $port is still in use after cleanup" >&2
    return 1
  fi
  return 0
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

# 启动为独立会话/进程组，pid 文件里记的就是组长，停止时整组一起收。
start_process() {
  pid_file="$1"
  log_file="$2"
  shift 2

  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" >>"$log_file" 2>&1 </dev/null &
  else
    nohup "$@" >>"$log_file" 2>&1 </dev/null &
  fi

  pid=$!
  echo "$pid" > "$pid_file"
}

stop_process() {
  pid_file="$1"
  pid="$(read_pid "$pid_file" 2>/dev/null || true)"

  if [ -n "$pid" ] && is_pid_running "$pid"; then
    if is_project_process "$pid"; then
      terminate_tree "$pid"
    else
      echo "pid $pid in $(basename "$pid_file") is not a project process, skipping" >&2
    fi
  fi

  rm -f "$pid_file"
}
