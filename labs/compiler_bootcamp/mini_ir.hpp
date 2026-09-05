#pragma once
#include <cstdint>
#include <iostream>
#include <limits>
#include <optional>
#include <stdexcept>
#include <utility>
#include <vector>

enum class Kind { Constant, Input, Add };
struct Node {
  Kind kind;
  std::int64_t value = 0;
  std::size_t lhs = 0, rhs = 0;
};
using Graph = std::vector<Node>;

// This teaching IR has checked signed i64 arithmetic, NOT MLIR's modular addi.
inline std::optional<std::int64_t> checkedAdd(std::int64_t a, std::int64_t b) {
  if ((b > 0 && a > std::numeric_limits<std::int64_t>::max() - b) ||
      (b < 0 && a < std::numeric_limits<std::int64_t>::min() - b))
    return std::nullopt;
  return a + b;
}

inline void verify(const Graph &graph) {
  if (graph.empty()) throw std::invalid_argument("empty graph");
  for (std::size_t i = 0; i < graph.size(); ++i) {
    if (graph[i].kind == Kind::Add && (graph[i].lhs >= i || graph[i].rhs >= i))
      throw std::invalid_argument("operands must refer to earlier nodes");
  }
}

inline std::int64_t evaluate(const Graph &graph, std::int64_t input) {
  verify(graph);
  std::vector<std::int64_t> values;
  for (const auto &node : graph) {
    if (node.kind == Kind::Constant) values.push_back(node.value);
    else if (node.kind == Kind::Input) values.push_back(input);
    else {
      auto sum = checkedAdd(values[node.lhs], values[node.rhs]);
      if (!sum) throw std::overflow_error("checked i64 add overflow");
      values.push_back(*sum);
    }
  }
  return values.back();
}

inline void dump(const Graph &graph) {
  for (std::size_t i = 0; i < graph.size(); ++i) {
    const auto &n = graph[i];
    std::cout << '%' << i << " = ";
    if (n.kind == Kind::Constant) std::cout << "constant " << n.value;
    else if (n.kind == Kind::Input) std::cout << "input";
    else std::cout << "add %" << n.lhs << ", %" << n.rhs;
    std::cout << '\n';
  }
}

inline void expect(bool ok, const char *message) {
  if (!ok) throw std::runtime_error(message);
}

template <class Fold> int testPass(Fold fold) {
  try {
    Graph graph{{Kind::Constant, 2}, {Kind::Constant, 3},
                {Kind::Add, 0, 0, 1}, {Kind::Input}, {Kind::Add, 0, 2, 3}};
    const Graph original = graph;
    std::cout << "Before (teaching IR, not MLIR):\n"; dump(graph);
    expect(fold(graph) == 1, "expected exactly one constant fold");
    expect(graph[2].kind == Kind::Constant && graph[2].value == 5, "2+3 must fold");
    expect(graph[4].kind == Kind::Add, "input-dependent add must remain");
    verify(graph);
    for (std::int64_t x = -10; x <= 10; ++x)
      expect(evaluate(original, x) == evaluate(graph, x), "numerical mismatch");
    expect(fold(graph) == 0, "the second pass must reach a fixed point");
    std::cout << "After:\n"; dump(graph);
    Graph chain{{Kind::Constant, 2}, {Kind::Constant, 3},
                {Kind::Add, 0, 0, 1}, {Kind::Add, 0, 2, 1}};
    expect(fold(chain) == 2 && chain.back().value == 8, "fold the full constant chain");
    const auto hi = std::numeric_limits<std::int64_t>::max();
    const auto lo = std::numeric_limits<std::int64_t>::min();
    for (const auto pair : {std::pair{hi, std::int64_t{1}}, std::pair{lo, std::int64_t{-1}}}) {
      Graph overflow{{Kind::Constant, pair.first}, {Kind::Constant, pair.second},
                     {Kind::Add, 0, 0, 1}};
      expect(fold(overflow) == 0, "overflow must not be evaluated by the folder");
      bool rejected = false;
      try { (void)evaluate(overflow, 0); } catch (const std::overflow_error &) { rejected = true; }
      expect(rejected, "runtime overflow behavior must be preserved");
    }
    Graph negative{{Kind::Constant, -7}, {Kind::Constant, 2}, {Kind::Add, 0, 0, 1}};
    expect(fold(negative) == 1 && negative.back().value == -5, "negative constant fold");
    Graph malformed{{Kind::Add, 0, 0, 1}, {Kind::Constant, 1}};
    bool rejected = false;
    try { fold(malformed); } catch (const std::invalid_argument &) { rejected = true; }
    expect(rejected, "verify malformed IR before rewriting");
    std::cout << "PASS: constants, variables, chain, fixed point, overflow, invalid IR\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
