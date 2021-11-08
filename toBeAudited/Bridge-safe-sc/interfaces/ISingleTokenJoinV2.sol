//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface ISingleTokenJoinV2 {
    struct UnderlyingTrade {
        UniswapV2SwapStruct[] swaps;
        uint256 quantity; //Quantity to buy
    }

    struct UniswapV2SwapStruct {
        address exchange;
        address[] path;
    }
    struct JoinTokenStructV2 {
        address inputToken;
        address outputBasket;
        uint256 inputAmount;
        uint256 outputAmount;
        UnderlyingTrade[] trades;
        uint256 deadline;
        uint16 referral;
    }

    function joinTokenSingle(JoinTokenStructV2 calldata _joinTokenStruct)
        external
        payable;
}
