pragma solidity ^0.6.2;

import {IERC20, ILimaToken} from "./ILimaToken.sol";


interface ILimaManager {
    function create(ILimaToken _limaToken, IERC20 _investmentToken, uint256 _amount, address _holder) external returns (bool);
    function redeem(ILimaToken _limaToken, IERC20 _payoutToken, uint256 _amount, address _holder) external returns (bool);
    function rebalance(ILimaToken _limaToken, address _bestToken) external returns (bool);
    function getTokenValue(address targetToken) external view returns (bool);
}