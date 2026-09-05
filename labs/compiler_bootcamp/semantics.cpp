#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

struct Tracked {
  std::string text;
  explicit Tracked(std::string value) : text(std::move(value)) {}
  Tracked(const Tracked &other) : text(other.text) { std::cout << "copy\n"; }
  Tracked(Tracked &&other) noexcept : text(std::move(other.text)) {
    std::cout << "move\n";
  }
};

int main() {
  std::vector<int> nodes{1, 2, 3};
  for (auto node : nodes) node += 10; // Copies: originals are unchanged.
  std::cout << "by value: " << nodes[0] << '\n';
  for (auto &node : nodes) node += 10;
  std::cout << "by reference: " << nodes[0] << '\n';

  Tracked source{"tensor"};
  Tracked copied{source};
  Tracked moved{std::move(source)};
  const Tracked frozen{"weight"};
  Tracked fromConst{std::move(frozen)}; // const T&& cannot bind to T&&.
  auto owner = std::make_unique<Tracked>("owned");
  auto newOwner = std::move(owner);
  std::cout << "owner empty: " << std::boolalpha << (owner == nullptr) << '\n';
  std::cout << "new owner: " << newOwner->text << '\n';
}
