// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SafeAssembly {
    uint256 public data;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function safeAdd(uint256 a, uint256 b) public pure returns (uint256 result) {
        assembly {
            result := add(a, b)
            if lt(result, a) { revert(0, 0) }
        }
    }

    function getOwner() public view returns (address result) {
        assembly {
            result := sload(owner.slot)
        }
    }
}
