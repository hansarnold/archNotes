#include <algorithm>
#include <atomic>
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <variant>
#include <vector>

int checks = 0;
void check(bool condition, const char* label) {
  if (!condition) throw std::runtime_error(label);
  ++checks;
}

int pick(const std::string&) { return 1; }
int pick(std::string&&) { return 2; }
template<class T> int relay(T&& value) { return pick(std::forward<T>(value)); }
template<class C> decltype(auto) first(C& values) { return (values.front()); }

struct Tracked {
  inline static int copies = 0, moves = 0;
  Tracked() = default;
  Tracked(const Tracked&) { ++copies; }
  Tracked(Tracked&&) noexcept { ++moves; }
};
struct CopyOnly {
  inline static int copies = 0;
  CopyOnly() = default;
  CopyOnly(const CopyOnly&) { ++copies; }
  ~CopyOnly() = default; // No move constructor: a copy can accept an rvalue.
};
struct NonMovable {
  NonMovable() = default;
  NonMovable(const NonMovable&) = delete;
  NonMovable(NonMovable&&) = delete;
};
NonMovable directResult() { return NonMovable{}; }
struct Base {
  virtual ~Base() = default;
  virtual int id() const { return 1; }
};
struct Derived : Base { int id() const override { return 2; } };

int main() {
  try {
    const int n = 7;
    auto copied = n;
    auto& borrowed = n;
    static_assert(std::is_same_v<decltype(copied), int>);
    static_assert(std::is_same_v<decltype(borrowed), const int&>);
    static_assert(std::is_same_v<decltype((n)), const int&>);
    int data[3]{};
    auto pointer = data;
    auto& array = data;
    static_assert(std::is_same_v<decltype(pointer), int*>);
    static_assert(std::is_same_v<decltype(array), int (&)[3]>);
    check(copied == 7 && &borrowed == &n, "T03 deduction");
    int value = 3;
    decltype(auto) alias = (value);
    alias = 8;
    check(value == 8, "T04 decltype(auto) alias");
    std::vector<int> count(4, 9), list{4, 9};
    check(count.size() == 4 && list.size() == 2, "T02 list constructors");
    int a = 50000, b = 50000;
    check(1LL * a * b == 2500000000LL, "T08 widen before multiplication");
    std::pair<int, int> tile{32, 64};
    auto [m, k] = tile;
    m = 1;
    auto& [rows, cols] = tile;
    rows = 16;
    check(tile.first == 16 && m == 1 && k == cols, "T11 binding copy and alias");
    std::string&& named = std::string("matmul");
    check(pick(named) == 1 && pick(std::move(named)) == 2, "T06 named rvalue reference");
    std::cout << "PASS: types and expressions\n";

    Tracked original;
    Tracked moved{std::move(original)};
    const Tracked frozen;
    Tracked constCopy{std::move(frozen)};
    check(Tracked::copies == 1 && Tracked::moves == 1, "L04 const move selects copy");
    static_assert(std::is_move_constructible_v<CopyOnly>);
    CopyOnly old;
    CopyOnly fromRvalue{std::move(old)};
    check(CopyOnly::copies == 1, "C02 move trait can be satisfied by copy");
    auto direct = directResult();
    (void)direct;
    check(true, "L05 guaranteed direct result needs neither copy nor move");
    auto owner = std::make_unique<int>(9);
    auto next = std::move(owner);
    check(!owner && *next == 9, "L06 unique_ptr source null");
    std::unique_ptr<int> adopted{next.release()};
    check(!next && *adopted == 9, "L07 release and readopt without leak");
    std::weak_ptr<int> weak;
    {
      auto shared = std::make_shared<int>(5);
      weak = shared;
      auto locked = weak.lock();
      check(locked && *locked == 5, "L09 lock retains owner");
    }
    check(!weak.lock(), "L09 weak expiration");
    Derived derived;
    Base sliced = derived;
    const Base& polymorphic = derived;
    check(sliced.id() == 1 && polymorphic.id() == 2, "C07 slicing versus reference");
    int captured = 4;
    auto closure = [captured]() mutable { return ++captured; };
    check(closure() == 5 && captured == 4, "L11 mutable copy capture");
    std::cout << "PASS: ownership, moves, and classes\n";

    std::string text = "tile";
    check(relay(text) == 1 && relay(std::string("tile")) == 2, "F05 forwarding categories");
    check(relay(std::as_const(text)) == 1, "F05 const lvalue forwarding");
    std::vector<int> values{3, -1, -2, 1, 3};
    first(values) = 4;
    check(values.front() == 4, "F06 reference-preserving return");
    values.erase(std::remove_if(values.begin(), values.end(), [](int x) { return x < 0; }), values.end());
    check(values == std::vector<int>({4, 1, 3}), "S04 adjacent removal");
    std::vector<int> output;
    output.reserve(values.size());
    check(output.empty(), "S02 reserve does not create elements");
    std::copy(values.begin(), values.end(), std::back_inserter(output));
    check(output == values, "S06 output iterator grows destination");
    values = {3, 1, 3, 2, 1};
    std::sort(values.begin(), values.end());
    values.erase(std::unique(values.begin(), values.end()), values.end());
    check(values == std::vector<int>({1, 2, 3}), "S07 sorted uniqueness");
    auto found = std::lower_bound(values.begin(), values.end(), 2);
    check(found != values.end() && *found == 2, "S05 lower_bound found");
    check(std::lower_bound(values.begin(), values.end(), 9) == values.end(), "S05 lower_bound absent");
    std::vector<double> costs{0.5, 1.5};
    check(std::accumulate(costs.begin(), costs.end(), 0) == 1, "S08 int accumulator truncates");
    check(std::accumulate(costs.begin(), costs.end(), 0.0) == 2.0, "S08 double accumulator");
    std::map<std::string, int> table{{"tile", 4}};
    int evaluations = 0;
    auto inserted = table.try_emplace("tile", ++evaluations);
    check(!inserted.second && evaluations == 1 && table.at("tile") == 4, "S09 eager argument, no replacement");
    check(table.find("missing") == table.end() && table.size() == 1, "S09 non-inserting query");
    check(table["missing"] == 0 && table.size() == 2, "S09 operator[] inserts");
    std::vector<bool> flags{true};
    auto proxy = flags[0];
    bool snapshot = flags[0];
    proxy = false;
    check(!flags[0] && snapshot, "S10 proxy versus bool snapshot");
    std::string storage = "tensor";
    std::string_view view{storage};
    check(view.substr(1) == "ensor", "S11 substring view with live owner");
    std::cout << "PASS: forwarding and STL\n";

    std::optional<int> result = 5;
    int fallbackCalls = 0;
    check(result.value_or(++fallbackCalls) == 5 && fallbackCalls == 1, "M03 eager fallback argument");
    std::variant<int, std::string> variant = std::string("graph");
    check(std::get_if<int>(&variant) == nullptr && std::get<std::string>(variant) == "graph", "M04 variant access");
    std::atomic<int> counter{0};
    auto increment = [&] { for (int i = 0; i < 100; ++i) counter.fetch_add(1, std::memory_order_relaxed); };
    std::thread one(increment), two(increment);
    one.join(); two.join();
    check(counter.load() == 200, "M10 atomic counter after joining");
    std::cout << "PASS: modern utilities and atomic counter\n";
    std::cout << "C++17 runtime checks: " << checks << "; compile-time assertions: 6\n";
  } catch (const std::exception& error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
