//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;
import "./ISingleTokenJoinV2.sol";
import "./ISingleNativeTokenExitV2.sol";

interface IInvestmentSafe {
    enum Steps {
        One,
        Two,
        Three
    }

    struct DelegateJoinData {
        address targetToken;
        uint256 amount;
        uint256 targetAmount;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct DelegateExitData {
        address sourceToken;
        uint256 amount;
        uint256 targetAmount;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @dev Delegated join and bridging back of target token
    function delegatedJoin(
        DelegateJoinData calldata joinData,
        uint256 minReturn,
        ISingleTokenJoinV2.UnderlyingTrade[] calldata _joinTokenTrades
    ) external;

    /// @dev Delegated exit and bridging back of target token
    function delegatedExit(
        DelegateExitData calldata exitData,
        uint256 minReturn,
        ISingleNativeTokenExitV2.ExitUnderlyingTrade[] calldata trades
    ) external;
}
