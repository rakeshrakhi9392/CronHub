#!/usr/bin/env python3

import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request


ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
LOG_DIR = ROOT_DIR / ".codespaces-logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
COMPOSE_FILE = "infra/docker/docker-compose.yml"

NODE_SERVICES = [
    ("@chronoflow/job-service", "job-service.log"),
    ("@chronoflow/auth-service", "auth-service.log"),
    ("@chronoflow/scheduler-service", "scheduler-service.log"),
    ("@chronoflow/executor-service", "executor-service.log"),
    ("@chronoflow/api-gateway", "api-gateway.log"),
]


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=ROOT_DIR, check=check, text=True, capture_output=False)


def run_allow_fail(cmd: list[str]) -> None:
    run(cmd, check=False)


def stop_existing_node_processes() -> None:
    run_allow_fail(["pkill", "-f", "services/.+/dist/index.js"])
    run_allow_fail(["pkill", "-f", "tsx watch src/index.ts"])


def start_node_service(workspace: str, log_name: str) -> None:
    log_path = LOG_DIR / log_name
    with log_path.open("ab") as log_file:
        subprocess.Popen(
            ["npm", "run", "dev", "-w", workspace],
            cwd=ROOT_DIR,
            stdout=log_file,
            stderr=log_file,
            start_new_session=True,
        )


def wait_for_container_health(service: str, timeout_seconds: int = 120) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        result = subprocess.run(
            ["docker", "compose", "-f", COMPOSE_FILE, "ps", service],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        output = result.stdout
        if "(healthy)" in output or ("Up" in output and "health:" not in output):
            return
        time.sleep(3)
    raise RuntimeError(f"Timed out waiting for service health: {service}")


def wait_for_http_ok(url: str, timeout_seconds: int = 150) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if 200 <= response.status < 300:
                    return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(3)
    raise RuntimeError(f"Timed out waiting for HTTP health endpoint: {url}")


def main() -> int:
    print("== ChronoFlow Codespaces bootstrap ==")
    print(f"Root: {ROOT_DIR}")
    print()

    print("[1/7] Stopping stale Node service processes...")
    stop_existing_node_processes()

    print("[2/7] Starting infra containers...")
    run(
        [
            "docker",
            "compose",
            "-f",
            COMPOSE_FILE,
            "up",
            "-d",
            "postgres",
            "redis",
            "zookeeper",
            "kafka",
            "jaeger",
            "otel-collector",
            "grafana",
            "prometheus",
        ]
    )

    print("[3/7] Waiting for infrastructure readiness...")
    wait_for_container_health("postgres")
    wait_for_container_health("redis")
    wait_for_container_health("kafka")
    run(["docker", "compose", "-f", COMPOSE_FILE, "ps"])

    print("[4/7] Installing Node dependencies...")
    run(["npm", "install"])

    print("[5/7] Building TypeScript workspaces...")
    run(["npm", "run", "build"])

    print("[6/7] Starting Node services...")
    for workspace, log_name in NODE_SERVICES:
        start_node_service(workspace, log_name)
        time.sleep(2)

    print("[7/7] Waiting for service health endpoints...")
    wait_for_http_ok("http://localhost:8081/api/v1/health")
    wait_for_http_ok("http://localhost:8084/actuator/health")
    wait_for_http_ok("http://localhost:8082/api/v1/health")
    wait_for_http_ok("http://localhost:8083/api/v1/health")
    wait_for_http_ok("http://localhost:8080/actuator/health")

    print("ChronoFlow startup complete.")
    print()
    print("Tail logs with:")
    print("  tail -f .codespaces-logs/api-gateway.log")
    print()
    print("Run E2E:")
    print("  python3 scripts/e2e.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
