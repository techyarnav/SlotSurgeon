// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 public value;
    address public owner;
    bool public isActive;
    uint8 public smallNumber;
    uint16 public mediumNumber;
    string public name;
    bytes32 public data;

    constructor() {
        owner = msg.sender;
        isActive = true;
        name = "SimpleStorage";
    }

    function setValue(uint256 _value) public {
        require(msg.sender == owner, "Not owner");
        value = _value;
    }
}
