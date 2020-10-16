pragma solidity ^0.6.2;

interface ILimaOracle {
    function fetchBestTokenAPR()
        external
        view
        returns (
            uint8,
            address,
            address
        );
}
