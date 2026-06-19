#!/usr/bin/env python3

import pathlib
import subprocess
import sys


ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent


def run_allow_fail(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=ROOT_DIR, check=False)


def main() -> int:
    print("Stopping Node service processes...")
    run_allow_fail(["pkill", "-f", "tsx watch src/index.ts"])
    run_allow_fail(["pkill", "-f", "services/.+/dist/index.js"])

    print("Stopping infra containers...")
    run_allow_fail(["docker", "compose", "-f", "infra/docker/docker-compose.yml", "down"])

    print("ChronoFlow stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
