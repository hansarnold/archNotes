module {
  func.func @duplicate(%x: i32, %y: i32) -> i32 {
    %a = arith.muli %x, %y : i32
    %b = arith.muli %x, %y : i32
    %sum = arith.addi %a, %b : i32
    return %sum : i32
  }
}
