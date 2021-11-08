//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./TestToken.sol";
import "../interfaces/ISingleTokenJoinV2.sol";
import "../interfaces/ISingleNativeTokenExitV2.sol";

contract TestSingleTokenJoin is ISingleTokenJoinV2, ISingleNativeTokenExitV2 {
    TestToken public immutable INTERMEDIATE_TOKEN;

    struct JoinTokenStruct {
        address inputToken;
        address outputBasket;
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 deadline;
        uint16 referral;
    }

    struct ExitTokenStruct {
        address inputBasket;
        uint256 inputAmount;
        uint256 minAmount;
        uint256 deadline;
        uint16 referral;
    }

    constructor(TestToken weth) {
        INTERMEDIATE_TOKEN = weth;
    }

    function joinTokenSingle(JoinTokenStructV2 calldata _joinTokenStruct)
        external
        payable
        override
    {
        TestToken(_joinTokenStruct.inputToken).burn(
            msg.sender,
            _joinTokenStruct.inputAmount
        );
        TestToken(_joinTokenStruct.outputBasket).mint(
            msg.sender,
            _joinTokenStruct.outputAmount
        );
    }

    function exit(ExitTokenStructV2 calldata _exitTokenStruct)
        external
        override
    {
        TestToken(_exitTokenStruct.inputBasket).burn(
            msg.sender,
            _exitTokenStruct.inputAmount
        );
        INTERMEDIATE_TOKEN.mint(msg.sender, _exitTokenStruct.minAmount);
    }
}
