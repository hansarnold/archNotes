#include "mini_ir.hpp"

std::size_t foldConstants(Graph &graph) {
  verify(graph);
  std::size_t changed = 0;
  for (auto &node : graph) {
    if (node.kind != Kind::Add) continue;
    const auto &lhs = graph[node.lhs];
    const auto &rhs = graph[node.rhs];
    if (lhs.kind != Kind::Constant || rhs.kind != Kind::Constant) continue;
    const auto sum = checkedAdd(lhs.value, rhs.value);
    if (!sum) continue;
    node = Node{Kind::Constant, *sum};
    ++changed;
  }
  return changed;
}

int main() { return testPass(foldConstants); }
