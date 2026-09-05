#include <algorithm>
#include <concepts>
#include <iostream>
#include <ranges>
#include <span>
#include <stdexcept>
#include <type_traits>
#include <utility>
#include <vector>

consteval int compileSize(int n) { return n * 2; }
constinit int mutableConstantInitialized = compileSize(4);
template<std::integral T> T twice(T n) { return n + n; }
template<class T> concept CanTwice = requires(T value) { twice(value); };
static_assert(CanTwice<int>);
static_assert(!CanTwice<double>);
static_assert(compileSize(3) == 6);

int main() {
  int checks = 0;
  auto check = [&](bool condition, const char* label) {
    if (!condition) throw std::runtime_error(label);
    ++checks;
  };
  try {
    check(twice(4) == 8, "F10 constrained function");
    ++mutableConstantInitialized;
    check(mutableConstantInitialized == 9, "M02 constinit does not imply const");
    std::vector<int> values{-2, 1, 3};
    const std::span<int> writableElements{values};
    writableElements[1] = 2;
    check(values[1] == 2, "M05 const view can modify non-const elements");
    std::span<const int> readonlyElements{values};
    static_assert(std::is_same_v<decltype(readonlyElements[0]), const int&>);
    check(readonlyElements.size() == 3, "M05 read-only element view");
    auto positive = values | std::views::filter([](int x) { return x > 0; });
    int sum = 0;
    for (int x : positive) sum += x;
    check(sum == 5, "M06 lazy filter over live storage");
    std::erase_if(values, [](int x) { return x < 0; });
    // Do not reuse the view after structural mutation; its cache may be stale.
    check(values == std::vector<int>({2, 3}), "S04 erase_if");
    check(std::cmp_less(-1, 1u), "T08 mixed-sign comparison");
    std::cout << "PASS: concepts, consteval/constinit, span, ranges, erase_if, cmp_less\n";
    std::cout << "C++20 runtime checks: " << checks << "; compile-time assertions: 4\n";
  } catch (const std::exception& error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
