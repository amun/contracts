//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface ISingleNativeTokenExitV2 {
    struct ExitUnderlyingTrade {
        ExitUniswapV2SwapStruct[] swaps;
    }

    struct ExitUniswapV2SwapStruct {
        address exchange;
        address[] path;
    }
    struct ExitTokenStructV2 {
        address inputBasket;
        uint256 inputAmount;
        uint256 minAmount;
        uint256 deadline;
        uint16 referral;
        ExitUnderlyingTrade[] trades;
    }

    function exit(ExitTokenStructV2 calldata _exitTokenStruct) external;
}
