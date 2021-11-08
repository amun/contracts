//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/IInvestmentSafeFactory.sol";
import "./InvestmentSafe.sol";

contract InvestmentSafeFactory is Ownable, IInvestmentSafeFactory {
    using SafeMath for uint256;

    mapping(address => bool) public hasCreatedSafe;
    address public override singleTokenJoin;
    address public override singleTokenExit;
    address public override weth;
    address public override childAmunWeth;
    IUniswapRouter public router;

    IChildAmunWeth public ChildAmunWeth;
    uint256 public immutable override EXIT_GAS = 1065035;
    uint256 public immutable override JOIN_GAS = 1451882;
    uint256 public immutable override GAS_CREATE_SAFE = 3145609;
    uint256 public maticToEthConversionRate = 402715000000000;

    bytes32 public immutable override _PERMIT_JOIN_TYPEHASH =
        keccak256(
            "PermitJoin(address sender,address targetToken,uint256 amount,uint256 targetAmount,uint256 nonce,uint256 deadline)"
        );

    bytes32 public immutable override _PERMIT_EXIT_TYPEHASH =
        keccak256(
            "PermitExit(address sender,address sourceToken,uint256 amount,uint256 targetAmount,uint256 nonce,uint256 deadline)"
        );

    constructor(
        address _singleTokenJoin,
        address _singleTokenExit,
        address _weth,
        address _childAmunWeth,
        address _router
    ) Ownable() {
        require(
            _singleTokenJoin != address(0),
            "new singleTokenJoin is the zero address"
        );
        require(
            _singleTokenExit != address(0),
            "new singleTokenExit is the zero address"
        );
        require(_weth != address(0), "new weth is the zero address");
        require(
            _childAmunWeth != address(0),
            "new childAmunWeth is the zero address"
        );
        require(_router != address(0), "new router is the zero address");

        singleTokenJoin = _singleTokenJoin;
        singleTokenExit = _singleTokenExit;
        weth = _weth;
        childAmunWeth = _childAmunWeth;
        router = IUniswapRouter(_router);
    }

    function _createSafe(address safeOwner)
        internal
        returns (address payable safe)
    {
        require(!hasCreatedSafe[safeOwner], "Safe already created for address");

        bytes memory bytecode = type(InvestmentSafe).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(safeOwner));
        assembly {
            safe := create2(0, add(bytecode, 32), mload(bytecode), salt)
            if iszero(extcodesize(safe)) {
                revert(0, 0)
            }
        }
        hasCreatedSafe[safeOwner] = true;

        emit SafeCreated(safeOwner, safe);
    }

    /// @dev creates user's safe using CREATE2 opcode
    /// @param safeName The name of the user safe
    /// @param safeOwner The address of safe owner
    /// @param joinData Struct of all data required to join basket and validate signature
    /// @param minReturn Minimal basket amount expected
    /// @param joinTokenTrades Trades to execute
    function createSafeAndJoinFor(
        string memory safeName,
        address safeOwner,
        InvestmentSafe.DelegateJoinData calldata joinData,
        uint256 minReturn,
        ISingleTokenJoinV2.UnderlyingTrade[] calldata joinTokenTrades
    ) external onlyOwner returns (address payable safe) {
        safe = _createSafe(safeOwner);
        InvestmentSafe(safe).initializeAndJoin(
            safeName,
            safeOwner,
            address(this),
            msg.sender,
            joinData,
            minReturn,
            joinTokenTrades,
            msg.sender
        );
    }

    /// @dev creates user's safe using CREATE2 opcode
    /// @param safeName The name of the user safe
    /// @param safeOwner The address of safe owner
    /// @param exitData Struct of all data required to exit basket and validate signature
    /// @param minReturn Minimal basket amount expected
    /// @param exitTokenTrades Trades to execute
    function createSafeAndExitFor(
        string memory safeName,
        address safeOwner,
        InvestmentSafe.DelegateExitData calldata exitData,
        uint256 minReturn,
        ISingleNativeTokenExitV2.ExitUnderlyingTrade[] calldata exitTokenTrades
    ) external onlyOwner returns (address payable safe) {
        safe = _createSafe(safeOwner);
        InvestmentSafe(safe).initializeAndExit(
            safeName,
            safeOwner,
            address(this),
            msg.sender,
            exitData,
            minReturn,
            exitTokenTrades,
            msg.sender
        );
    }

    /// @dev creates user's safe using CREATE2 opcode
    /// @param safeName The name of the user safe
    /// @param safeOwner The address of safe owner
    function createSafeFor(string memory safeName, address safeOwner)
        external
        override
        onlyOwner
        returns (address payable safe)
    {
        safe = _createSafe(safeOwner);

        InvestmentSafe(safe).initialize(
            safeName,
            safeOwner,
            address(this),
            msg.sender
        );
    }

    /// @dev creates user's safe using CREATE2 opcode
    /// @param safeName The name of the user safe
    function createSafe(string memory safeName)
        external
        returns (address payable safe)
    {
        safe = _createSafe(msg.sender);
        InvestmentSafe(safe).initialize(
            safeName,
            msg.sender,
            address(this),
            msg.sender
        );
    }

    /// @dev calculates the CREATE2 address for an address
    /// @param safeOwner The address of safe owner
    /// @return safe The safe address of safeOwner
    function safeFor(address safeOwner)
        external
        view
        override
        returns (address safe)
    {
        bytes memory bytecode = type(InvestmentSafe).creationCode;

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                keccak256(abi.encodePacked(safeOwner)),
                keccak256(bytecode)
            )
        );

        safe = address(uint160(uint256(hash)));
    }

    /// @dev Sets conversion rate used to pay gasfee in eth
    /// @param _maticToEthConversionRate The conversion rate to set
    function setMaticToEthConversionRate(uint256 _maticToEthConversionRate)
        external
        onlyOwner
    {
        maticToEthConversionRate = _maticToEthConversionRate;
    }

    function getWethUsedForGas(uint256 gas)
        external
        view
        override
        returns (uint256 wethUsedForSafe)
    {
        return getWethUsedForGas2(gas, tx.gasprice);
    }

    function getWethUsedForGas2(uint256 gas, uint256 gasprice)
        public
        view
        returns (uint256 wethUsedForSafe)
    {
        wethUsedForSafe = gasprice.mul(gas).mul(maticToEthConversionRate).div(
            1 ether
        );
    }
}
