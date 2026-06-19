#!/usr/bin/env python3

import os
import subprocess
import sys
import time


NAMESPACE = os.environ.get("NAMESPACE", "chronoflow")
SELECTOR = os.environ.get("SELECTOR", "app=chrono-executor-service")
SLEEP_SECONDS = int(os.environ.get("SLEEP_SECONDS", "20"))


def run(cmd: list[str], capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, text=True, capture_output=capture)


def main() -> int:
    print(f"Finding executor pod in namespace '{NAMESPACE}'...")
    pod_name = run(
        [
            "kubectl",
            "get",
            "pods",
            "-n",
            NAMESPACE,
            "-l",
            SELECTOR,
            "-o",
            "jsonpath={.items[0].metadata.name}",
        ],
        capture=True,
    ).stdout.strip()

    if not pod_name:
        print(f"No executor pod found for selector '{SELECTOR}' in namespace '{NAMESPACE}'.")
        return 1

    print(f"Deleting pod: {pod_name}")
    run(["kubectl", "delete", "pod", pod_name, "-n", NAMESPACE, "--grace-period=0", "--force"])

    print(f"Waiting {SLEEP_SECONDS}s for replacement pod scheduling...")
    time.sleep(SLEEP_SECONDS)

    print("Current executor pods:")
    run(["kubectl", "get", "pods", "-n", NAMESPACE, "-l", SELECTOR])

    print()
    print("Recovery check guidance:")
    print("1) Confirm new executor pod is Running and Ready.")
    print("2) Check DLQ and retry metrics in Grafana/Prometheus.")
    print("3) Verify pending retries are consumed after restart.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
