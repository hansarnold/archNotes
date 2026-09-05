#include "repairs_test.hpp"

void renameNodes(std::vector<std::string> &) {
  // TODO: prefix every original name with "op."; avoid copying loop elements.
  throw std::logic_error("TODO: renameNodes");
}

std::string saveName(std::string_view) {
  // TODO: return an owning string; a view does not extend an input's lifetime.
  throw std::logic_error("TODO: saveName");
}

void removeNegative(std::vector<int> &) {
  // TODO: remove negative values, including adjacent ones, using erase's result.
  throw std::logic_error("TODO: removeNegative");
}

int main() { return testRepairs(renameNodes, saveName, removeNegative); }
