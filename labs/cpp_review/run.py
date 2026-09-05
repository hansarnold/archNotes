"""Run safe review probes and check expected compile failures; never run UB examples."""
import argparse
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
NEGATIVES = ("COPY_UNIQUE", "CONST_MUTATION", "NARROWING", "LVALUE_TO_RVALUE", "EXPLICIT_CONVERSION", "DELETED_MOVE")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--std", choices=("17", "20", "all"), default="17")
    args = parser.parse_args()
    compiler = shlex.split(os.environ.get("CXX", "c++"))
    if not compiler or not shutil.which(compiler[0]):
        parser.error("Install a C++ compiler or set CXX explicitly.")
    print("Compiler:", shlex.join(compiler), flush=True)
    modes = ("17", "20") if args.std == "all" else (args.std,)
    try:
        version = subprocess.run([*compiler, "--version"], check=True, text=True, capture_output=True, timeout=15)
        print(version.stdout.splitlines()[0], flush=True)
        with tempfile.TemporaryDirectory(prefix="archnotes-review-") as directory:
            for standard in modes:
                flags = [f"-std=c++{standard}", "-Wall", "-Wextra", "-Wpedantic", "-O0", "-g", "-pthread"]
                binary = Path(directory) / f"probe{standard}"
                subprocess.run([*compiler, *flags, str(ROOT / f"probe{standard}.cpp"), "-o", str(binary)], check=True, timeout=120)
                subprocess.run([str(binary)], check=True, timeout=30)
                if standard == "17":
                    for case in NEGATIVES:
                        result = subprocess.run([*compiler, *flags, "-fsyntax-only", f"-D{case}", str(ROOT / "negative.cpp")], capture_output=True, text=True, timeout=30)
                        if result.returncode == 0:
                            raise RuntimeError(f"Expected compiler rejection: {case}")
                        if result.returncode < 0 or "error:" not in result.stderr.lower():
                            raise RuntimeError(f"Compiler failure without a normal diagnostic: {case}\n{result.stderr}")
                        print(f"PASS: expected rejection {case}", flush=True)
        print("Selected review probes passed. This is representative coverage, not proof of all C++ rules.")
    except subprocess.TimeoutExpired:
        print("FAIL: compiler or program timed out; no pass claimed.")
        return 124
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(f"FAIL: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
