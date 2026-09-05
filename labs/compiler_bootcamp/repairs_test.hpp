#pragma once
#include <iostream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

inline void require(bool ok, const char *message) {
  if (!ok) throw std::runtime_error(message);
}

template <class Rename, class OwnName, class Remove>
int testRepairs(Rename rename, OwnName ownName, Remove remove) {
  try {
    std::vector<std::string> names{"matmul", "relu"};
    rename(names);
    require(names == std::vector<std::string>({"op.matmul", "op.relu"}),
            "rename must modify the original strings");
    const auto saved = ownName(std::string("temporary-name"));
    require(saved == "temporary-name", "the returned name must own its bytes");
    for (auto values : {std::vector<int>{-1, -2, 3, -4, 5},
                        std::vector<int>{-1, -2}, std::vector<int>{},
                        std::vector<int>{1, 2}}) {
      std::vector<int> expected;
      for (int v : values) if (v >= 0) expected.push_back(v);
      remove(values);
      require(values == expected, "erase must handle adjacent and final elements");
    }
    std::cout << "PASS: ownership, original mutation, adjacent erase, empty input\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
