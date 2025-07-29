// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ComplexStorage {

    uint128 public firstHalf;
    uint128 public secondHalf;
    address public owner;
    uint96 public balance;
    bool public isActive;
    uint8 public status;
    uint16 public version;
    uint32 public timestamp;
    uint32 public counter;
    string public description;
    bytes public metadata;
    uint256[] public numbers;
    mapping(address => uint256) public balances;

    struct UserInfo {
        uint256 balance;
        bool active;
        uint32 lastAction;
    }

    mapping(address => UserInfo) public users;


    constructor() {
        owner = msg.sender;
        isActive = true;
        version = 1;
        timestamp = uint32(block.timestamp);
    }
}
