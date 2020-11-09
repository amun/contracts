pragma solidity ^0.6.12;

interface ILimaOracle {
    function fetchBestTokenAPR()
        external
        view
        returns (
            uint8,
            address,
            address
        );

    function requestDeliveryStatus(address _receiver)
        external 
        returns  (
            bytes32 requestId
        );
}
