// Each selected case must fail compilation; none is executed.
#include <memory>
#include <string>
#include <utility>

#if defined(COPY_UNIQUE)
int main() { auto a = std::make_unique<int>(1); auto b = a; }
#elif defined(CONST_MUTATION)
int main() { const int n = 1; const int* p = &n; *p = 2; }
#elif defined(NARROWING)
int main() { int n{3.5}; return n; }
#elif defined(LVALUE_TO_RVALUE)
void consume(std::string&&) {}
int main() { std::string text = "tile"; consume(text); }
#elif defined(EXPLICIT_CONVERSION)
struct Count { explicit Count(int) {} };
void consume(Count) {}
int main() { consume(3); }
#elif defined(DELETED_MOVE)
struct X { X() = default; X(const X&) = default; X(X&&) = delete; };
int main() { X x; X y(std::move(x)); }
#else
#error Select one negative case.
#endif
