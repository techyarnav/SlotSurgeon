// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TokenContract {
    address public owner;
    uint256 public totalSupply;
    uint8 public decimals;
    bool public paused;
    mapping(address => uint256) public balances;
    mapping(address => bool) public blacklisted;
    string public name;
    string public symbol;

    constructor() {
        owner = msg.sender;
        decimals = 18;
        name = "Token";
        symbol = "TKN";
    }
}
