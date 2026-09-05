"""Build and run a C++17 exercise without writing generated files to the repo."""
import argparse
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
NAMES = ("semantics", "repairs", "repairs_solution", "fold", "fold_solution")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exercise", choices=(*NAMES, "solutions"))
    parser.add_argument("--sanitize", action="store_true", help="enable ASan and UBSan")
    args = parser.parse_args()
    compiler = shlex.split(os.environ.get("CXX", "c++"))
    if not compiler or not shutil.which(compiler[0]):
        parser.error("Install a C++17 compiler or set CXX to clang++/g++.")
    selected = ("semantics", "repairs_solution", "fold_solution") if args.exercise == "solutions" else (args.exercise,)
    flags = ["-std=c++17", "-Wall", "-Wextra", "-Wpedantic", "-O0", "-g"]
    if args.sanitize:
        flags += ["-fsanitize=address,undefined", "-fno-omit-frame-pointer"]
    with tempfile.TemporaryDirectory(prefix="archnotes-cpp-") as directory:
        for name in selected:
            binary = Path(directory) / name
            try:
                subprocess.run([*compiler, *flags, str(ROOT / f"{name}.cpp"), "-o", str(binary)], check=True, timeout=120)
                print(f"Running {name}", flush=True)
                result = subprocess.run([str(binary)], timeout=30)
            except subprocess.TimeoutExpired:
                print("Timed out: inspect your loop or local compiler/runtime setup. No pass result claimed.")
                return 124
            except subprocess.CalledProcessError as error:
                print("Compilation failed; review the compiler diagnostic above.")
                return error.returncode
            if result.returncode:
                if name in ("repairs", "fold"):
                    print("Starter tests intentionally fail until you implement the TODOs.")
                return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
