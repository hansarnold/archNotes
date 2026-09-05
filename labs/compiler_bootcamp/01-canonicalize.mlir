module {
  func.func @add_zero(%x: i32) -> i32 {
    %zero = arith.constant 0 : i32
    %sum = arith.addi %x, %zero : i32
    return %sum : i32
  }
}
