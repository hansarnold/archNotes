#include "repairs_test.hpp"

void renameNodes(std::vector<std::string> &names) {
  for (auto &name : names) name = "op." + name;
}

std::string saveName(std::string_view name) { return std::string(name); }

void removeNegative(std::vector<int> &values) {
  for (auto it = values.begin(); it != values.end();) {
    if (*it < 0) it = values.erase(it);
    else ++it;
  }
}

int main() { return testRepairs(renameNodes, saveName, removeNegative); }
