// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CourseSub {
    address public owner;
    uint256 public coursePrice = 0.01 ether;
    uint256 public courseDuration = 7 days; // Duration granted upon purchase

    mapping(address => uint256) public accessExpiry;

    constructor() {
        owner = msg.sender;
    }

    // Pay to gain or extend access
    function buyAccess() external payable {
        require(msg.value >= coursePrice, "Insufficient payment");

        if (block.timestamp > accessExpiry[msg.sender]) {
            // Reset access time if expired
            accessExpiry[msg.sender] = block.timestamp + courseDuration;
        } else {
            // Extend existing access
            accessExpiry[msg.sender] += courseDuration;
        }
    }

    // Check if a user currently has valid access
    function hasAccess(address user) external view returns (bool) {
        return block.timestamp < accessExpiry[user];
    }

    // Immediately consume all of the caller’s access (for debugging)
    function consumeAllAccess() external {
        accessExpiry[msg.sender] = block.timestamp;
    }

    // Returns remaining hours of access (0 if expired)
    function getRemainingHours(address user) external view returns (uint256) {
        if (block.timestamp >= accessExpiry[user]) {
            return 0;
        } else {
            // Convert remaining seconds to hours
            return (accessExpiry[user] - block.timestamp) / 3600;
        }
    }

    // View the contract’s current balance (only owner can call)
    function getContractBalance() external view returns (uint256) {
        require(msg.sender == owner, "Not authorized");
        return address(this).balance;
    }

    // Withdraw all funds from the contract (only owner can call)
    function withdrawAll() external {
        require(msg.sender == owner, "Only owner can withdraw");
        require(address(this).balance > 0, "No funds to withdraw");
        payable(owner).transfer(address(this).balance);
    }
}
