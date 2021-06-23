// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceReferenceFeed.sol";

contract ManualPriceReferenceFeed is Ownable, IPriceReferenceFeed {
    uint256 public latestResult;
    uint256 public lastUpdate;

    function update(uint256 _value) external onlyOwner {
        latestResult = _value;
        lastUpdate = block.timestamp;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(false, "NOT_SUPPORTED");
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        updatedAt = lastUpdate;
        answer = int256(latestResult);
    }
}
