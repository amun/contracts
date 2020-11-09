pragma solidity ^0.6.12;

interface ILimaOracleReceiver {
    function receiveOracleData(bytes32 _requestId, bytes32 _data) external;
}