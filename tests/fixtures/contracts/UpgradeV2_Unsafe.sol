// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TokenContract {

    uint256 public totalSupply;
    address public owner;
    uint8 public decimals;
    bool public paused;
    mapping(address => uint256) public balances;
    mapping(address => bool) public blacklisted;
    string public name;
    string public symbol;
    uint256 public newFeature;

    constructor() {
        owner = msg.sender;
        decimals = 18;
        name = "Token";
        symbol = "TKN";
    }
}
