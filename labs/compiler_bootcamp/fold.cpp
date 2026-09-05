#include "mini_ir.hpp"

std::size_t foldConstants(Graph &graph) {
  verify(graph);
  // TODO: walk in topological order. Replace Add only when both operands are
  // Constant and checkedAdd succeeds. Keep node indices stable. Return count.
  return 0;
}

int main() { return testPass(foldConstants); }
