// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BaseContract {
    address public owner;
    uint256 public baseValue;
    bool public initialized;

    constructor() {
        owner = msg.sender;
        initialized = true;
    }
}

contract ChildContract is BaseContract {
    uint256 public childValue;
    string public childName;
    mapping(address => uint256) public childBalances;

    constructor(string memory _name) {
        childName = _name;
    }
}

contract GrandChildContract is ChildContract {
    bytes32 public grandChildData;
    uint128 public packed1;
    uint128 public packed2;

    constructor() ChildContract("GrandChild") {
        grandChildData = keccak256("data");
    }
}
